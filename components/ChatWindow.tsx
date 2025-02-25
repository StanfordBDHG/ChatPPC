"use client";

import { type Message } from "ai";
import { useChat } from "ai/react";
import { useState, useEffect } from "react";
import type { FormEvent, ReactNode } from "react";
import { toast } from "sonner";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";
import { v4 as uuidv4 } from "uuid";

import { ChatMessageBubble } from "@/components/ChatMessageBubble";
import { IntermediateStep } from "./IntermediateStep";
import { Button } from "./ui/button";
import { ArrowDown, LoaderCircle, Paperclip } from "lucide-react";
import { Checkbox } from "./ui/checkbox";
import { UploadDocumentsForm } from "./UploadDocumentsForm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { cn } from "@/utils/cn";
import { ChatHistory } from "@/components/ChatHistory";

function ChatMessages(props: {
  messages: Message[];
  emptyStateComponent: ReactNode;
  sourcesForMessages: Record<string, any>;
  aiEmoji?: string;
  className?: string;
}) {
  return (
    <div className="flex flex-col max-w-[768px] mx-auto pb-12 w-full">
      {props.messages.map((m, i) => {
        if (m.role === "system") {
          return <IntermediateStep key={m.id} message={m} />;
        }

        const sourceKey = (props.messages.length - 1 - i).toString();
        return (
          <ChatMessageBubble
            key={m.id}
            message={m}
            aiEmoji={props.aiEmoji}
            sources={props.sourcesForMessages[sourceKey]}
          />
        );
      })}
    </div>
  );
}

function ScrollToBottom(props: { className?: string }) {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();

  if (isAtBottom) return null;
  return (
    <Button
      variant="outline"
      className={props.className}
      onClick={() => scrollToBottom()}
    >
      <ArrowDown className="w-4 h-4" />
      <span>Scroll to bottom</span>
    </Button>
  );
}

function ChatInput(props: {
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  loading?: boolean;
  placeholder?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.stopPropagation();
        e.preventDefault();
        props.onSubmit(e);
      }}
      className={cn("flex w-full flex-col", props.className)}
    >
      <div className="border border-input bg-secondary rounded-lg flex flex-col gap-2 max-w-[768px] w-full mx-auto">
        <input
          value={props.value}
          placeholder={props.placeholder}
          onChange={props.onChange}
          className="border-none outline-none bg-transparent p-4"
        />

        <div className="flex justify-between ml-4 mr-2 mb-2">
          <div className="flex gap-3">{props.children}</div>

          <Button type="submit" className="self-end" disabled={props.loading}>
            {props.loading ? (
              <span role="status" className="flex justify-center">
                <LoaderCircle className="animate-spin" />
                <span className="sr-only">Loading...</span>
              </span>
            ) : (
              <span>Send</span>
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}

function StickyToBottomContent(props: {
  content: ReactNode;
  footer?: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  const context = useStickToBottomContext();

  // scrollRef will also switch between overflow: unset to overflow: auto
  return (
    <div
      ref={context.scrollRef}
      style={{ width: "100%", height: "100%" }}
      className={cn("grid grid-rows-[1fr,auto]", props.className)}
    >
      <div ref={context.contentRef} className={props.contentClassName}>
        {props.content}
      </div>

      {props.footer}
    </div>
  );
}

export function ChatWindow(props: {
  endpoint: string;
  emptyStateComponent: ReactNode;
  placeholder?: string;
  emoji?: string;
  showIngestForm?: boolean;
  showIntermediateStepsToggle?: boolean;
}) {
  const [showIntermediateSteps, setShowIntermediateSteps] = useState(
    !!props.showIntermediateStepsToggle,
  );
  const [intermediateStepsLoading, setIntermediateStepsLoading] =
    useState(false);

  const [sourcesForMessages, setSourcesForMessages] = useState<
    Record<string, any>
  >({});
  
  // Add sessionId state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Initialize sessionId from localStorage or create a new one
  useEffect(() => {
    console.log("Initializing session from localStorage or creating new one");
    const savedSessionId = localStorage.getItem("chatSessionId");
    if (savedSessionId) {
      console.log("Found existing session ID:", savedSessionId);
      setSessionId(savedSessionId);
      loadChatHistory(savedSessionId);
    } else {
      const newSessionId = uuidv4();
      console.log("Created new session ID:", newSessionId);
      setSessionId(newSessionId);
      localStorage.setItem("chatSessionId", newSessionId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadChatHistory = async (sid: string) => {
    if (!sid) return;
    
    try {
      console.log("Loading chat history for session:", sid);
      setIsLoadingHistory(true);
      const response = await fetch(`/api/chat/history?sessionId=${sid}`);
      
      if (!response.ok) {
        throw new Error("Failed to load chat history");
      }
      
      const data = await response.json();
      console.log("History data received:", data);
      
      if (data.messages && data.messages.length > 0) {
        console.log("Setting messages from history:", data.messages);
        chat.setMessages(data.messages);
      }
    } catch (error) {
      console.error("Error loading chat history:", error);
      toast.error("Failed to load chat history");
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const saveChatMessages = async (messages: Message[]) => {
    if (!sessionId || messages.length === 0) {
      console.log("Not saving messages - sessionId or messages empty", { sessionId, messageCount: messages.length });
      return;
    }
    
    console.log("Saving messages to database", { 
      sessionId, 
      messageCount: messages.length,
      messageRoles: messages.map(m => m.role).join(', ')
    });
    
    try {
      const response = await fetch("/api/chat/store", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
          messages,
        }),
      });
      
      const data = await response.json();
      console.log("Save response:", data);
      
      if (!response.ok) {
        console.error("Error saving messages:", data.error);
      }
    } catch (error) {
      console.error("Exception saving chat messages:", error);
    }
  };

  const handleSelectSession = (selectedSessionId: string) => {
    setSessionId(selectedSessionId);
    localStorage.setItem("chatSessionId", selectedSessionId);
    loadChatHistory(selectedSessionId);
  };

  const startNewChat = () => {
    const newSessionId = uuidv4();
    setSessionId(newSessionId);
    localStorage.setItem("chatSessionId", newSessionId);
    chat.setMessages([]);
    setSourcesForMessages({});
  };

  const chat = useChat({
    api: props.endpoint,
    id: sessionId || undefined,
    body: {
      sessionId: sessionId
    },
    onResponse(response) {
      console.log("Chat onResponse callback triggered");
      const sourcesHeader = response.headers.get("x-sources");
      const sources = sourcesHeader
        ? JSON.parse(Buffer.from(sourcesHeader, "base64").toString("utf8"))
        : [];

      const messageIndexHeader = response.headers.get("x-message-index");
      if (sources.length && messageIndexHeader !== null) {
        setSourcesForMessages({
          ...sourcesForMessages,
          [messageIndexHeader]: sources,
        });
      }
    },
    onFinish(message) {
      // This is called when the AI response is complete
      console.log("Chat onFinish callback triggered with message:", message);
      console.log("Current messages in chat:", chat.messages);
      
      // Save the entire conversation including the AI's response
      if (chat.messages.length > 0 && sessionId) {
        console.log("Saving messages from onFinish callback");
        saveChatMessages(chat.messages);
      } else {
        console.log("Not saving from onFinish - conditions not met", { 
          hasMessages: chat.messages.length > 0, 
          hasSessionId: !!sessionId 
        });
      }
    },
    streamMode: "text",
    onError: (e) => {
      console.error("Chat error:", e);
      toast.error(`Error while processing your request`, {
        description: e.message,
      });
    },
  });

  async function sendMessage(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    console.log("sendMessage called");
    
    if (chat.isLoading || intermediateStepsLoading) {
      console.log("Not proceeding - chat is loading:", { 
        chatIsLoading: chat.isLoading, 
        intermediateStepsLoading 
      });
      return;
    }

    if (!showIntermediateSteps) {
      // For normal mode, let the chat handler manage messages
      console.log("Using normal chat flow");
      
      // First, manually add the user message to ensure we have it
      const userMessage: Message = {
        id: chat.messages.length.toString(),
        content: chat.input,
        role: "user",
      };
      
      // Remember the current message count
      const prevMessageCount = chat.messages.length;
      
      // Submit the form which will trigger the API call
      chat.handleSubmit(e);
      
      // Set up a timer to check if messages were updated
      setTimeout(() => {
        console.log(`Checking messages after submission (previous: ${prevMessageCount}, current: ${chat.messages.length})`);
        if (chat.messages.length > prevMessageCount) {
          console.log("Messages were updated, saving to database");
          saveChatMessages(chat.messages);
        }
      }, 500); // Check after a short delay to allow the message to be processed
      
      return;
    }

    // Handle intermediate steps mode
    console.log("Using intermediate steps mode");
    setIntermediateStepsLoading(true);

    // Create user message
    const userMessage: Message = {
      id: chat.messages.length.toString(),
      content: chat.input,
      role: "user",
    };

    chat.setInput("");
    const messagesWithUserReply = chat.messages.concat(userMessage);
    chat.setMessages(messagesWithUserReply);
    
    // Save the user message right away
    console.log("Saving user message in intermediate steps mode");
    saveChatMessages(messagesWithUserReply);

    try {
      const response = await fetch(props.endpoint, {
        method: "POST",
        body: JSON.stringify({
          messages: messagesWithUserReply,
          show_intermediate_steps: true,
          sessionId: sessionId,
        }),
      });
      
      if (!response.ok) {
        const json = await response.json();
        console.error("Error in intermediate steps mode:", json);
        toast.error(`Error while processing your request`, {
          description: json.error,
        });
        setIntermediateStepsLoading(false);
        return;
      }
      
      const json = await response.json();
      const responseMessages: Message[] = json.messages;
      
      // Represent intermediate steps as system messages for display purposes
      const toolCallMessages = responseMessages.filter(
        (responseMessage: Message) => {
          return (
            (responseMessage.role === "assistant" &&
              !!responseMessage.tool_calls?.length) ||
            responseMessage.role === "tool"
          );
        },
      );

      const intermediateStepMessages = [];
      for (let i = 0; i < toolCallMessages.length; i += 2) {
        const aiMessage = toolCallMessages[i];
        const toolMessage = toolCallMessages[i + 1];
        intermediateStepMessages.push({
          id: (messagesWithUserReply.length + i / 2).toString(),
          role: "system" as const,
          content: JSON.stringify({
            action: aiMessage.tool_calls?.[0],
            observation: toolMessage.content,
          }),
        });
      }
      const newMessages = messagesWithUserReply;
      for (const message of intermediateStepMessages) {
        newMessages.push(message);
        chat.setMessages([...newMessages]);
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 + Math.random() * 1000),
        );
      }

      const finalMessages = [
        ...newMessages,
        {
          id: newMessages.length.toString(),
          content: responseMessages[responseMessages.length - 1].content,
          role: "assistant" as const,
        },
      ];
      
      chat.setMessages(finalMessages);
      
      // Save final messages including AI response
      saveChatMessages(finalMessages);
    } catch (error: any) {
      console.error("Error in intermediate steps mode:", error);
      toast.error(`Error while processing your request`, {
        description: error.message,
      });
    } finally {
      setIntermediateStepsLoading(false);
    }
  }

  // Add an effect to watch for changes to chat.messages and save them
  useEffect(() => {
    if (chat.messages.length > 0 && !chat.isLoading && !isLoadingHistory) {
      console.log("Messages changed, current count:", chat.messages.length);
      
      // Check if we have an assistant message (meaning we have a complete exchange)
      const hasAssistantMessage = chat.messages.some(m => m.role === "assistant");
      if (hasAssistantMessage) {
        console.log("Messages include an assistant response, saving to database");
        saveChatMessages(chat.messages);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.messages, chat.isLoading]);

  return (
    <StickToBottom>
      <StickyToBottomContent
        className="absolute inset-0"
        contentClassName="py-8 px-2"
        content={
          isLoadingHistory ? (
            <div className="flex justify-center items-center h-full">
              <div className="text-center">
                <LoaderCircle className="animate-spin h-8 w-8 mx-auto mb-2" />
                <p>Loading chat history...</p>
              </div>
            </div>
          ) : chat.messages.length === 0 ? (
            <div>{props.emptyStateComponent}</div>
          ) : (
            <ChatMessages
              aiEmoji={props.emoji}
              messages={chat.messages}
              emptyStateComponent={props.emptyStateComponent}
              sourcesForMessages={sourcesForMessages}
            />
          )
        }
        footer={
          <div className="sticky bottom-8 px-2">
            <ScrollToBottom className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4" />
            <ChatInput
              value={chat.input}
              onChange={chat.handleInputChange}
              onSubmit={sendMessage}
              loading={chat.isLoading || intermediateStepsLoading || isLoadingHistory}
              placeholder={
                props.placeholder ?? "What's it like to be a pirate?"
              }
            >
              <ChatHistory onSelectSession={handleSelectSession} />
              
              <Button 
                variant="ghost" 
                className="pl-2 pr-3"
                onClick={startNewChat}
                disabled={chat.messages.length === 0}
              >
                <span>New Chat</span>
              </Button>

              {props.showIngestForm && (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      variant="ghost"
                      className="pl-2 pr-3 -ml-2"
                      disabled={chat.messages.length !== 0}
                    >
                      <Paperclip className="size-4" />
                      <span>Upload document</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Upload document</DialogTitle>
                      <DialogDescription>
                        Upload a document to use for the chat.
                      </DialogDescription>
                    </DialogHeader>
                    <UploadDocumentsForm />
                  </DialogContent>
                </Dialog>
              )}

              {props.showIntermediateStepsToggle && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="show_intermediate_steps"
                    name="show_intermediate_steps"
                    checked={showIntermediateSteps}
                    disabled={chat.isLoading || intermediateStepsLoading}
                    onCheckedChange={(e) => setShowIntermediateSteps(!!e)}
                  />
                  <label htmlFor="show_intermediate_steps" className="text-sm">
                    Show intermediate steps
                  </label>
                </div>
              )}
            </ChatInput>
          </div>
        }
      ></StickyToBottomContent>
    </StickToBottom>
  );
}
