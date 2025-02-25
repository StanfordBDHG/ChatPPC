"use client";

import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { History } from "lucide-react";

interface Session {
  id: string;
  created_at: string;
  updated_at: string;
}

export function ChatHistory({ 
  onSelectSession 
}: { 
  onSelectSession: (id: string) => void 
}) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [open, setOpen] = useState(false);
  
  const loadSessions = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/chat/sessions');
      if (!res.ok) {
        throw new Error('Failed to fetch sessions');
      }
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch (error) {
      toast.error('Error loading chat history');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    if (open) {
      loadSessions();
    }
  }, [open]);
  
  const handleSelectSession = (sessionId: string) => {
    onSelectSession(sessionId);
    setOpen(false);
  };
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" className="pl-2 pr-3 -ml-2">
          <History className="size-4" />
          <span>Chat History</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Previous Conversations</DialogTitle>
          <DialogDescription>
            Select a previous conversation to continue.
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div>Loading...</div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">
            No previous conversations found.
          </div>
        ) : (
          <div className="max-h-[50vh] overflow-y-auto">
            <ul className="space-y-2">
              {sessions.map((session) => (
                <li key={session.id}>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start text-left"
                    onClick={() => handleSelectSession(session.id)}
                  >
                    <div>
                      <div className="font-medium">
                        {new Date(session.updated_at).toLocaleString()}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        Session ID: {session.id}
                      </div>
                    </div>
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
} 