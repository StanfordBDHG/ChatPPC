'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { ConversationDetail } from './ConversationDetail'
import { createClient } from '@/lib/supabase'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Stats {
  totalConversations: number
  activeSessions: number
  messagesToday: number
  averageLength: number
}

interface Conversation {
  id: string
  created_at: string
  updated_at: string
  message_count: number
  first_message?: {
    content: string
    role: string
  } | null
}

interface StatCard {
  title: string
  value: number | undefined
  description: string
}

interface ConversationData {
  conversations: Conversation[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

interface ChatAnalyticsProps {
  stats: Stats | null
}

export function ChatAnalytics({ stats }: ChatAnalyticsProps) {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const PAGE_SIZE_OPTIONS = [5, 10, 20, 50]

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

  const fetchConversations = async () => {
    setLoading(true)
    try {
      const data = await fetchWithAuth(`/api/admin/conversations?page=${pagination.page}&limit=${pagination.limit}`)
      setConversations(data.conversations)
      setPagination(data.pagination)
      setError(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchConversations()
  }, [pagination.page, pagination.limit])

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }))
  }

  const handlePageSizeChange = (newLimit: number) => {
    setPagination(prev => ({ ...prev, limit: newLimit, page: 1 }))
  }

  const statCards: StatCard[] = [
    { title: 'Total Conversations', value: stats?.totalConversations, description: 'All time' },
    { title: 'Active Sessions', value: stats?.activeSessions, description: 'Last 24 hours' },
    { title: 'Messages Today', value: stats?.messagesToday, description: 'Since midnight' },
    { title: 'Average Length', value: stats?.averageLength, description: 'Messages per session' }
  ]

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <div key={card.title} className="rounded-lg border bg-card p-6">
            <h3 className="text-lg font-semibold">{card.title}</h3>
            <p className="text-2xl font-bold mt-2">{card.value}</p>
            <p className="text-sm text-muted-foreground">{card.description}</p>
          </div>
        ))}
      </div>
      
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Recent Conversations</h3>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Show:</span>
              <select 
                value={pagination.limit}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                className="border border-input rounded px-2 py-1 text-sm"
                disabled={loading}
              >
                {PAGE_SIZE_OPTIONS.map(size => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchConversations}
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Refresh'}
            </Button>
          </div>
        </div>
        
        {error && (
          <div className="text-destructive text-sm mb-4">
            Error: {error}
          </div>
        )}
        
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading conversations...
          </div>
        ) : conversations.length > 0 ? (
          <>
            <div className="space-y-2 mb-4">
              {conversations.map((conversation) => (
                <div 
                  key={conversation.id} 
                  className="flex items-center justify-between p-3 rounded border hover:bg-accent/50 cursor-pointer transition-colors"
                  onClick={() => setSelectedConversationId(conversation.id)}
                >
                  <div className="flex-1">
                    <p className="font-medium">Session {conversation.id.slice(0, 8)}</p>
                    <p className="text-sm text-muted-foreground mb-1">
                      {conversation.message_count} messages • Updated {new Date(conversation.updated_at).toLocaleDateString()}
                    </p>
                    {conversation.first_message && (
                      <p className="text-sm text-gray-600 italic">
                        &ldquo;{conversation.first_message.content}&rdquo;
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-sm text-muted-foreground">
                      {new Date(conversation.created_at).toLocaleDateString()}
                    </div>
                    <Button variant="ghost" size="sm" onClick={(e) => {
                      e.stopPropagation()
                      setSelectedConversationId(conversation.id)
                    }}>
                      View →
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Pagination Controls */}
            <div className="flex items-center justify-between border-t pt-4">
              <div className="text-sm text-muted-foreground">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} conversations
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1 || loading}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                
                <span className="text-sm font-medium px-3">
                  Page {pagination.page} of {pagination.pages}
                </span>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.pages || loading}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No conversations found
          </div>
        )}
      </div>

      {selectedConversationId && (
        <ConversationDetail 
          conversationId={selectedConversationId}
          onClose={() => setSelectedConversationId(null)}
        />
      )}
    </div>
  )
}