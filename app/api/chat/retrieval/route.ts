import { NextRequest, NextResponse } from "next/server";
import { Message as VercelChatMessage, StreamingTextResponse } from "ai";

import { createClient } from "@supabase/supabase-js";

import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { Document } from "@langchain/core/documents";
import { RunnableSequence, RunnableLambda } from "@langchain/core/runnables";
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

// Multi-query / HyDE-lite: generate a few alternative phrasings of the
// user's question so retrieval can match documents using different
// vocabulary (e.g. "POCT" vs "point of care testing").
const PARAPHRASE_TEMPLATE = `You help search a medical clinic knowledge base. Rewrite the user's question in exactly 2 alternative ways that might match how the knowledge base describes the same topic. Expand ALL abbreviations and acronyms to their full spelled-out form (e.g. "POCT" -> "point of care testing", "GPCHC" -> "Gardner Packard Children's Health Center"). Vary the word choice. Keep each rewrite on a single line. Return ONLY the 2 rewrites, one per line — no numbering, no bullets, no commentary.

Question: {question}`;
const paraphrasePrompt = PromptTemplate.fromTemplate(PARAPHRASE_TEMPLATE);

const ANSWER_TEMPLATE = `You should answer staff members' questions about our clinic. Please only answer in English. Talk to the user like they work at the clinic, not like a patient. Your answers should come from searching the uploaded files under Knowledge. To answer a user's question, please provide any resource links contained in the knoweldge file and please always link the PPC website section where the response came from in your response to the user. If there is a relevant link in the knowledge file, make sure to display that link in your response. Be concise, and limit extra statements or thoughts. If you give any links, remind users that they should log in to Google with their stanford.edu email address to get access to the files.

If you can't find the answer to the question by searching the knowledge attached, you should state that: "The information you are requesting does not exist on the Stanford PPC site. Sometimes, ChatPPC can make mistakes though. If you think that this is an error, click on the PPC webiste link above to search the site manually. Have feedback? Be sure to use the button in the top left of the screen."

Each entry in the context begins with a "Section:" line identifying the clinical area the resource belongs to (e.g. "Development and Behavior", "Nutrition and Healthy Lifestyle", "Health Supervision"). If a retrieved entry's Section is not topically related to the user's question, ignore that entry — do not cite it, link it, or mention it. Only use entries whose Section matches the topic being asked about.

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

type HybridRow = {
  id: number;
  content: string;
  metadata: Record<string, any>;
  similarity: number;
};

// Call the `hybrid_search` Postgres function: vector similarity + keyword
// boost in one round trip. Defined in
// supabase/migrations/00000000000004_hybrid_search.sql.
async function hybridSearch(
  client: any,
  embeddings: OpenAIEmbeddings,
  query: string,
  matchCount: number = 10,
): Promise<Array<Document & { id: number; similarity: number }>> {
  const queryEmbedding = await embeddings.embedQuery(query);
  const { data, error } = await client.rpc("hybrid_search", {
    query_embedding: queryEmbedding,
    query_text: query,
    match_count: matchCount,
  });
  if (error) {
    console.error("hybrid_search RPC error:", error);
    return [];
  }
  return ((data ?? []) as HybridRow[]).map((row) =>
    Object.assign(
      new Document({ pageContent: row.content, metadata: row.metadata }),
      { id: row.id, similarity: row.similarity },
    ),
  );
}

// LLM reranker: read the query and each retrieved doc jointly and score
// them 0-10 for topical relevance. Catches cases where embedding similarity
// is high but the topic is wrong (e.g. "Treatment program options" under
// Nutrition matching "ADHD medication options" via the word "options").
async function rerankWithLLM(
  model: ChatOpenAI,
  question: string,
  docs: Document[],
  keep: number,
): Promise<Document[]> {
  if (docs.length <= keep) return docs;

  const numbered = docs
    .map((d, i) => `[${i}] ${d.pageContent.replace(/\n+/g, " ").slice(0, 500)}`)
    .join("\n");

  const prompt = `You are scoring how relevant each retrieved resource is to a user's question. For each document, output a single line in the exact format "INDEX: SCORE" where SCORE is 0-10 (10 = directly answers the question, 0 = unrelated topic). Pay close attention to the "Section:" field — a resource from an unrelated clinical section should score low even if it shares keywords.

Question: ${question}

Documents:
${numbered}

Output the scores, one per line, nothing else:`;

  let raw = "";
  try {
    const res = await model.invoke(prompt);
    raw = typeof res.content === "string"
      ? res.content
      : String((res as any).content ?? "");
  } catch (e) {
    console.error("rerank failed, falling back to original order:", e);
    return docs.slice(0, keep);
  }

  const scores = new Map<number, number>();
  for (const line of raw.split("\n")) {
    const m = line.match(/\[?(\d+)\]?\s*[:\-]?\s*(\d+(?:\.\d+)?)/);
    if (m) {
      const idx = parseInt(m[1], 10);
      const score = parseFloat(m[2]);
      if (idx >= 0 && idx < docs.length && !isNaN(score)) scores.set(idx, score);
    }
  }

  if (scores.size === 0) return docs.slice(0, keep);

  return docs
    .map((doc, i) => ({ doc, score: scores.get(i) ?? 0, idx: i }))
    .sort((a, b) => b.score - a.score || a.idx - b.idx)
    .slice(0, keep)
    .map((x) => x.doc);
}

// Multi-query retrieval: paraphrase the question, fan out hybrid_search
// over each variant, union and dedupe. Keeps the best-scoring hit per doc id.
async function multiQueryRetrieve(
  client: any,
  embeddings: OpenAIEmbeddings,
  paraphraseChain: RunnableSequence,
  question: string,
  perQueryK: number = 8,
  finalK: number = 15,
): Promise<Document[]> {
  let paraphrases: string[] = [];
  try {
    const raw = (await paraphraseChain.invoke({ question })) as string;
    paraphrases = raw
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && l.length < 400)
      .slice(0, 2);
  } catch (e) {
    console.error("paraphrase generation failed:", e);
  }

  const queries = [question, ...paraphrases];

  const resultSets = await Promise.all(
    queries.map((q) => hybridSearch(client, embeddings, q, perQueryK)),
  );

  const bestById = new Map<number, Document & { similarity: number }>();
  for (const docs of resultSets) {
    for (const doc of docs) {
      const existing = bestById.get((doc as any).id);
      if (!existing || existing.similarity < doc.similarity) {
        bestById.set((doc as any).id, doc);
      }
    }
  }

  return Array.from(bestById.values())
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, finalK);
}

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

    const standaloneQuestionChain = RunnableSequence.from([
      condenseQuestionPrompt,
      model,
      new StringOutputParser(),
    ]);

    // Only condense when there is prior chat history. On the first turn the
    // user's original wording (including acronyms like "POCT") is the best
    // retrieval signal — paraphrasing it through an LLM loses exact tokens.
    const hasChatHistory = previousMessages.length > 0;
    const questionChain = hasChatHistory
      ? standaloneQuestionChain
      : RunnableLambda.from((input: any) => input.question);

    const paraphraseChain = RunnableSequence.from([
      paraphrasePrompt,
      model,
      new StringOutputParser(),
    ]);

    let resolveWithDocuments: (value: Document[]) => void;
    const documentPromise = new Promise<Document[]>((resolve) => {
      resolveWithDocuments = resolve;
    });

    const retrievalChain = async (question: string) => {
      const candidates = await multiQueryRetrieve(
        client,
        embeddings,
        paraphraseChain,
        question,
      );
      const reranked = await rerankWithLLM(model, question, candidates, 8);
      resolveWithDocuments(reranked);
      return combineDocumentsFn(reranked);
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
        question: questionChain,
        chat_history: (input: any) => input.chat_history,
      },
      answerChain,
      new BytesOutputParser(),
    ]);

    const stream = await conversationalRetrievalQAChain.stream({
      question: currentMessageContent,
      chat_history: formatVercelMessages(previousMessages),
    });

    const documents = await documentPromise;
    const serializedSources = Buffer.from(
      JSON.stringify(
        documents.map((doc) => {
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
