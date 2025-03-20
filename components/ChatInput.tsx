"use client";

import { cn } from "@/utils/cn";
import { Button } from "./ui/button";
import { LoaderCircle } from "lucide-react";
import { FormEvent, ReactNode } from "react";

export function ChatInput(props: {
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  loading?: boolean;
  placeholder?: string;
  children?: ReactNode;
  className?: string;
}) {
  // Function to handle key press
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !props.loading) {
      e.preventDefault();
      // Just trigger the form submission directly by finding the form element and submitting it
      const form = e.currentTarget.closest('form');
      if (form) {
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      }
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        props.onSubmit(e);
      }}
      className={cn("w-full max-w-[768px] mx-auto", props.className)}
    >
      <div className="relative flex items-center">
        <input
          value={props.value}
          placeholder={props.placeholder}
          onChange={props.onChange}
          onKeyDown={handleKeyDown}
          className="w-full rounded-lg border border-input bg-secondary px-4 py-3 pr-20"
        />
        
        <div className="absolute right-2 flex items-center gap-2">
          {props.children}
          <Button 
            type="submit" 
            variant="default"
            size="sm" 
            disabled={props.loading}
          >
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