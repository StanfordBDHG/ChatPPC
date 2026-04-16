import { NextRequest, NextResponse } from "next/server";
import { Message as VercelChatMessage, StreamingTextResponse } from "ai";

import { createClient } from "@supabase/supabase-js";

import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { Document } from "@langchain/core/documents";
import { RunnableSequence } from "@langchain/core/runnables";
import {
  BytesOutputParser,
  StringOutputParser,
} from "@langchain/core/output_parsers";

export const runtime = "edge";

const combineDocumentsFn = (docs: Document[]) => {
  const serializedDocs = docs.map((doc) => doc.pageContent);
  return serializedDocs.join("\n\n");
};

const formatVercelMessages = (chatHistory: VercelChatMessage[]) => {
  const formattedDialogueTurns = chatHistory.map((message) => {
    if (message.role === "user") {
      return `Human: ${message.content}`;
    } else if (message.role === "assistant") {
      return `Assistant: ${message.content}`;
    } else {
      return `${message.role}: ${message.content}`;
    }
  });
  return formattedDialogueTurns.join("\n");
};

const CONDENSE_QUESTION_TEMPLATE = `Given the following conversation and a follow up question, rephrase the follow up question to be a standalone question, in its original language.

<chat_history>
  {chat_history}
</chat_history>

Follow Up Input: {question}
Standalone question:`;
const condenseQuestionPrompt = PromptTemplate.fromTemplate(
  CONDENSE_QUESTION_TEMPLATE,
);

const ANSWER_TEMPLATE = `You should answer people's questions about our clinic. Please only answer in English. Your answers should come from searching the uploaded files under Knowledge. The knowledge files are in Markdown format, and you should use the headers to identify the right information to provide. If there is a relevant link in the knowledge file, please display that link in your response. Be concise, and limit extra statements or thoughts. When searching the internet, you should preferentially include results on this website: https://med.stanford.edu/ppc.html. If you give any links, remind users that they should log in to Google with their stanford.edu email address to get access to the files.

If you can't find the answer to the question by searching the knowledge attached, you should state that: "The information you are requesting does not exist on the Stanford PPC site. Sometimes, ChatPPC can make mistakes though. If you think that this is an error, click on the PPC webiste link above to search the site manually. Have feedback? Be sure to use the button in the top left of the screen."

Answer the question based only on the following context and chat history:
<context>
  {context}
</context>

<chat_history>
  {chat_history}
</chat_history>

Question: {question}
`;
const answerPrompt = PromptTemplate.fromTemplate(ANSWER_TEMPLATE);

/**
 * This handler initializes and calls a retrieval chain. It composes the chain using
 * LangChain Expression Language. See the docs for more information:
 *
 * https://js.langchain.com/v0.2/docs/how_to/qa_chat_history_how_to/
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages = body.messages ?? [];
    const previousMessages = messages.slice(0, -1);
    const currentMessageContent = messages[messages.length - 1].content;

    const model = new ChatOpenAI({
      model: "gpt-4o-mini",
      temperature: 0.2,
    });

    const client = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PRIVATE_KEY!,
    );
    const embeddings = new OpenAIEmbeddings();

    /**
     * Hybrid search: combines vector similarity with keyword matching.
     * Falls back to pure vector search if hybrid_search function
     * doesn't exist yet (migration not run).
     */
    const hybridRetrieve = async (query: string): Promise<Document[]> => {
      const queryEmbedding = await embeddings.embedQuery(query);

      // Try hybrid search first (vector + keyword boost)
      try {
        const { data, error } = await client.rpc("hybrid_search", {
          query_embedding: queryEmbedding,
          query_text: query,
          match_count: 10,
          filter: {},
        });

        if (!error && data && data.length > 0) {
          return data.map(
            (row: any) =>
              new Document({
                pageContent: row.content,
                metadata: row.metadata,
              }),
          );
        }
      } catch {
        // hybrid_search function may not exist yet, fall back
      }

      // Fallback: standard vector search via match_documents
      const { data: fallbackData, error } = await client.rpc("match_documents", {
        query_embedding: queryEmbedding,
        match_count: 10,
        filter: {},
      });

      if (error) throw new Error(error.message);

      return (fallbackData ?? []).map(
        (row: any) =>
          new Document({
            pageContent: row.content,
            metadata: row.metadata,
          }),
      );
    }

    const standaloneQuestionChain = RunnableSequence.from([
      condenseQuestionPrompt,
      model,
      new StringOutputParser(),
    ]);

    let resolvedDocuments: Document[] = [];

    const retrievalChain = async (question: string) => {
      const docs = await hybridRetrieve(question);
      resolvedDocuments = docs;
      return combineDocumentsFn(docs);
    };

    const answerChain = RunnableSequence.from([
      {
        context: async (input: any) => retrievalChain(input.question),
        chat_history: (input: any) => input.chat_history,
        question: (input: any) => input.question,
      },
      answerPrompt,
      model,
    ]);

    const conversationalRetrievalQAChain = RunnableSequence.from([
      {
        question: standaloneQuestionChain,
        chat_history: (input: any) => input.chat_history,
      },
      answerChain,
      new BytesOutputParser(),
    ]);

    const stream = await conversationalRetrievalQAChain.stream({
      question: currentMessageContent,
      chat_history: formatVercelMessages(previousMessages),
    });

    const serializedSources = Buffer.from(
      JSON.stringify(
        resolvedDocuments.map((doc) => {
          return {
            pageContent: doc.pageContent.slice(0, 50) + "...",
            metadata: doc.metadata,
          };
        }),
      ),
    ).toString("base64");

    return new StreamingTextResponse(stream, {
      headers: {
        "x-message-index": (previousMessages.length + 1).toString(),
        "x-sources": serializedSources,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
