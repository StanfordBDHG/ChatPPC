'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase'
import { ArrowLeft } from 'lucide-react'

interface Message {
  id: string
  role: string
  content: string
  tool_calls?: any
  sequence_order: number
  created_at: string
}

interface ConversationData {
  session: {
    id: string
    created_at: string
    updated_at: string
  }
  messages: Message[]
  messageCount: number
}

export default function ConversationDetail() {
  const params = useParams()
  const router = useRouter()
  const [data, setData] = useState<ConversationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchConversation()
  }, [params.id])

  const fetchConversation = async () => {
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        setError('Not authenticated')
        setLoading(false)
        return
      }

      const response = await fetch(`/api/admin/conversations/${params.id}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to fetch conversation: ${response.status} - ${errorText}`)
      }
      
      const conversationData = await response.json()
      setData(conversationData)
      
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>
        <div>Loading conversation...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>
        <div className="text-destructive">Error: {error}</div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>
        <div>Conversation not found</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Conversation Details</h1>
          <p className="text-muted-foreground">
            Session {data.session.id.slice(0, 8)} • {data.messageCount} messages
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <h3 className="font-semibold">Created</h3>
          <p className="text-sm text-muted-foreground">
            {new Date(data.session.created_at).toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <h3 className="font-semibold">Last Updated</h3>
          <p className="text-sm text-muted-foreground">
            {new Date(data.session.updated_at).toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <h3 className="font-semibold">Messages</h3>
          <p className="text-sm text-muted-foreground">
            {data.messageCount} total
          </p>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold">Messages</h3>
        </div>
        <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
          {data.messages.map((message, index) => (
            <div
              key={message.id}
              className={`rounded-lg p-3 ${
                message.role === 'user'
                  ? 'bg-primary/10 ml-8'
                  : message.role === 'assistant'
                  ? 'bg-secondary mr-8'
                  : 'bg-muted'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium capitalize">
                  {message.role}
                </span>
                <span className="text-xs text-muted-foreground">
                  #{message.sequence_order + 1}
                </span>
              </div>
              <div className="whitespace-pre-wrap text-sm">
                {message.content}
              </div>
              {message.tool_calls && (
                <div className="mt-2 p-2 bg-muted rounded text-xs">
                  <strong>Tool Calls:</strong>
                  <pre className="mt-1 overflow-x-auto">
                    {JSON.stringify(message.tool_calls, null, 2)}
                  </pre>
                </div>
              )}
              <div className="mt-2 text-xs text-muted-foreground">
                {new Date(message.created_at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}