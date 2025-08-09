'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

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

interface StatCard {
  title: string
  value: number | undefined
  description: string
}

interface ChatAnalyticsProps {
  stats: Stats | null
  conversations: Conversation[]
}

export function ChatAnalytics({ stats, conversations }: ChatAnalyticsProps) {
  const router = useRouter()

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
        <h3 className="text-lg font-semibold mb-4">Recent Conversations</h3>
        {conversations.length > 0 ? (
          <div className="space-y-2">
            {conversations.map((conversation) => (
              <div 
                key={conversation.id} 
                className="flex items-center justify-between p-3 rounded border hover:bg-accent/50 cursor-pointer transition-colors"
                onClick={() => router.push(`/admin/conversation/${conversation.id}`)}
              >
                <div>
                  <p className="font-medium">Session {conversation.id.slice(0, 8)}</p>
                  <p className="text-sm text-muted-foreground">
                    {conversation.message_count} messages • Updated {new Date(conversation.updated_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-sm text-muted-foreground">
                    {new Date(conversation.created_at).toLocaleDateString()}
                  </div>
                  <Button variant="ghost" size="sm" onClick={(e) => {
                    e.stopPropagation()
                    router.push(`/admin/conversation/${conversation.id}`)
                  }}>
                    View →
                  </Button>
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