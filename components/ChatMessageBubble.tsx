import { cn } from "@/utils/cn";
import type { Message } from "ai/react";
import Markdown from 'react-markdown'
import { useCallback } from "react";

export function ChatMessageBubble(props: {
  message: Message;
  aiEmoji?: string;
  sources: any[];
  sessionId: string;
}) {
  const handleLinkClick = useCallback(async (e: React.MouseEvent<HTMLAnchorElement>, href: string, text: string) => {
    // Don't interfere with normal link behavior
    // Just log the click in the background using sendBeacon which is more reliable for page transitions
    try {
      if (!props.sessionId) {
        console.error('No session ID provided');
        return;
      }
      
      console.log('Logging link click for session:', props.sessionId, 'URL:', href);
      
      const data = {
        sessionId: props.sessionId,
        messageId: props.message.id,
        linkUrl: href,
        linkText: text
      };
      
      // Use sendBeacon which is more reliable when pages are navigating away
      navigator.sendBeacon(
        '/api/chat/link-clicks',
        new Blob([JSON.stringify(data)], { type: 'application/json' })
      );
    } catch (error) {
      console.error('Failed to log link click:', error);
    }
  }, [props.message.id, props.sessionId]);

  return (
    <div
      className={cn(
        `rounded-[24px] max-w-[80%] mb-8 flex`,
        props.message.role === "user"
          ? "bg-secondary text-secondary-foreground px-4 py-2"
          : null,
        props.message.role === "user" ? "ml-auto" : "mr-auto",
      )}
    >
      {props.message.role !== "user" && (
        <div className="mr-4 border bg-secondary -mt-2 rounded-full w-10 h-10 flex-shrink-0 flex items-center justify-center">
          {props.aiEmoji}
        </div>
      )}

      <div className="flex flex-col">
        <div className="prose dark:prose-invert prose-a:text-blue-500 prose-a:underline max-w-none prose-p:text-foreground">
          <Markdown
            components={{
              a: ({ node, ...props }) => {
                // Safely extract text content from children without unnecessary conversion
                const text = Array.isArray(props.children)
                  ? props.children[0]
                  : props.children || '';
                return (
                  <a 
                    {...props} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    onClick={(e) => handleLinkClick(e, props.href || '', String(text))}
                  />
                );
              }
            }}
          >
            {props.message.content}
          </Markdown>
        </div>
      </div>
    </div>
  );
}
