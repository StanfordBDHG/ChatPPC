'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

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
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        setError('Not authenticated')
        setLoading(false)
        return
      }

      // Fetch stats
      const statsResponse = await fetch('/api/admin/stats', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })
      
      if (!statsResponse.ok) {
        const errorText = await statsResponse.text()
        console.log('Stats API error:', statsResponse.status, errorText)
        throw new Error(`Failed to fetch stats: ${statsResponse.status} - ${errorText}`)
      }
      
      const statsData = await statsResponse.json()
      setStats(statsData)

      // Fetch recent conversations
      const conversationsResponse = await fetch('/api/admin/conversations?limit=5', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })
      
      if (!conversationsResponse.ok) {
        throw new Error('Failed to fetch conversations')
      }
      
      const conversationsData = await conversationsResponse.json()
      setConversations(conversationsData.conversations)
      
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">ChatPPC Admin Dashboard</h2>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">ChatPPC Admin Dashboard</h2>
          <p className="text-destructive">Error: {error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">ChatPPC Admin Dashboard</h2>
        <p className="text-muted-foreground">
          Manage conversations and view chat analytics
        </p>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold">Total Conversations</h3>
          <p className="text-2xl font-bold mt-2">{stats?.totalConversations}</p>
          <p className="text-sm text-muted-foreground">All time</p>
        </div>
        
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold">Active Sessions</h3>
          <p className="text-2xl font-bold mt-2">{stats?.activeSessions}</p>
          <p className="text-sm text-muted-foreground">Last 24 hours</p>
        </div>
        
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold">Messages Today</h3>
          <p className="text-2xl font-bold mt-2">{stats?.messagesToday}</p>
          <p className="text-sm text-muted-foreground">Since midnight</p>
        </div>
        
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold">Average Length</h3>
          <p className="text-2xl font-bold mt-2">{stats?.averageLength}</p>
          <p className="text-sm text-muted-foreground">Messages per session</p>
        </div>
      </div>
      
      <div className="rounded-lg border bg-card p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Conversations</h3>
        {conversations.length > 0 ? (
          <div className="space-y-2">
            {conversations.map((conversation) => (
              <div key={conversation.id} className="flex items-center justify-between p-3 rounded border">
                <div>
                  <p className="font-medium">Session {conversation.id.slice(0, 8)}</p>
                  <p className="text-sm text-muted-foreground">
                    {conversation.message_count} messages • Updated {new Date(conversation.updated_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-sm text-muted-foreground">
                  {new Date(conversation.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-muted-foreground">
            No conversations yet
          </div>
        )}
      </div>
    </div>
  )
}