'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { X, User, Bot } from 'lucide-react'

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

  useEffect(() => {
    fetchConversationDetail()
  }, [conversationId])

  const fetchWithAuth = async (url: string) => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) throw new Error('Not authenticated')

    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${session.access_token}` }
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`${response.status} - ${errorText}`)
    }
    
    return response.json()
  }

  const fetchConversationDetail = async () => {
    try {
      const data = await fetchWithAuth(`/api/admin/conversations/${conversationId}`)
      setConversationDetail(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Conversation Details</h2>
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
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Conversation Details</h2>
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold">Session {conversationDetail?.session.id.slice(0, 8)}</h2>
            <p className="text-sm text-muted-foreground">
              Started: {conversationDetail && formatDate(conversationDetail.session.created_at)}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="mb-4 p-4 bg-muted rounded-lg">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <strong>Total Messages:</strong> {conversationDetail?.messageCount || 0}
            </div>
            <div>
              <strong>Created:</strong> {conversationDetail && formatDate(conversationDetail.session.created_at)}
            </div>
            <div>
              <strong>Last Updated:</strong> {conversationDetail && formatDate(conversationDetail.session.updated_at)}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4">
          <h3 className="font-medium sticky top-0 bg-white py-2">Messages</h3>
          {conversationDetail?.messages.map((message) => (
            <div key={message.id} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex gap-3 max-w-[80%] ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  message.role === 'user' 
                    ? 'bg-blue-100 text-blue-600' 
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {message.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </div>
                
                <div className={`rounded-lg p-3 ${
                  message.role === 'user' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-100 text-gray-900'
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
                  
                  <div className={`text-xs mt-2 opacity-75 ${message.role === 'user' ? 'text-blue-100' : 'text-gray-500'}`}>
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