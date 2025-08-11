'use client'

import { useEffect, useState, useCallback } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Conversations } from '@/components/admin/Conversations'
import { DocumentManagement } from '@/components/admin/DocumentManagement'
import { BarChart3, FileText, MessageCircle } from 'lucide-react'
import Link from 'next/link'
import { fetchWithAuth } from '@/lib/adminUtils'

interface Stats {
  totalConversations: number
  activeSessions: number
  messagesToday: number
  averageLength: number
}


export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)


  const fetchData = useCallback(async () => {
    try {
      const statsData = await fetchWithAuth('/api/admin/stats')
      setStats(statsData)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const renderHeader = (subtitle?: string) => (
    <div>
      <h2 className="text-2xl font-bold text-foreground">ChatPPC Admin Dashboard</h2>
      {subtitle && (
        <p className={subtitle?.startsWith('Error:') ? 'text-destructive' : 'text-muted-foreground'}>
          {subtitle}
        </p>
      )}
    </div>
  )

  if (loading) return <div className="space-y-6">{renderHeader('Loading...')}</div>
  if (error) return <div className="space-y-6">{renderHeader(`Error: ${error}`)}</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        {renderHeader()}
        <Button asChild variant="outline" size="default">
          <Link href="/" className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            Back to Chat
          </Link>
        </Button>
      </div>
      
      <Tabs defaultValue="analytics" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Conversations
          </TabsTrigger>
          <TabsTrigger value="documents" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Document Management
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="analytics">
          <Conversations stats={stats} />
        </TabsContent>
        
        <TabsContent value="documents">
          <DocumentManagement />
        </TabsContent>
      </Tabs>
    </div>
  )
}