'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { X, User, Bot } from 'lucide-react'
import { fetchWithAuth, formatDate } from '@/lib/adminUtils'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  tool_calls?: any
  sequence_order: number
  created_at: string
}

interface ChatSession {
  id: string
  created_at: string
  updated_at: string
}

interface ConversationDetail {
  session: ChatSession
  messages: ChatMessage[]
  messageCount: number
}

interface ConversationDetailProps {
  conversationId: string
  onClose: () => void
}

export function ConversationDetail({ conversationId, onClose }: ConversationDetailProps) {
  const [conversationDetail, setConversationDetail] = useState<ConversationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchConversationDetail = useCallback(async () => {
    try {
      const data = await fetchWithAuth(`/api/admin/conversations/${conversationId}`)
      setConversationDetail(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [conversationId])

  useEffect(() => {
    fetchConversationDetail()
  }, [fetchConversationDetail])


  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
        <div className="bg-background rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-foreground">Conversation Details</h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p>Loading conversation...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
        <div className="bg-background rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-foreground">Conversation Details</h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-destructive">Error: {error}</p>
          <Button onClick={fetchConversationDetail} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-background rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Session {conversationDetail?.session.id.slice(0, 8)}</h2>
            <p className="text-sm text-muted-foreground">
              Started: {conversationDetail && formatDate(conversationDetail.session.created_at)}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="mb-4 p-4 bg-muted rounded-lg">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <strong>Total Messages:</strong> {conversationDetail?.messageCount || 0}
            </div>
            <div>
              <strong>Last Updated:</strong> {conversationDetail && formatDate(conversationDetail.session.updated_at)}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4">
          <h3 className="font-medium sticky top-0 bg-background py-2 text-foreground">Messages</h3>
          {conversationDetail?.messages.map((message) => (
            <div key={message.id} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex gap-3 max-w-[80%] ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  message.role === 'user' 
                    ? 'bg-primary/10 text-primary' 
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {message.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </div>
                
                <div className={`rounded-lg p-3 ${
                  message.role === 'user' 
                    ? 'bg-secondary text-secondary-foreground' 
                    : 'bg-secondary text-secondary-foreground'
                }`}>
                  <div className="text-sm leading-relaxed whitespace-pre-wrap">
                    {message.content}
                  </div>
                  
                  {message.tool_calls && (
                    <details className="mt-2 text-xs opacity-75">
                      <summary className="cursor-pointer">Tool Calls</summary>
                      <pre className="mt-1 overflow-x-auto">
                        {JSON.stringify(message.tool_calls, null, 2)}
                      </pre>
                    </details>
                  )}
                  
                  <div className={`text-xs mt-2 opacity-75 ${message.role === 'user' ? 'text-secondary-foreground' : 'text-secondary-foreground'}`}>
                    {formatDate(message.created_at)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}