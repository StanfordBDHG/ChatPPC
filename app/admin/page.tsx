'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ChatAnalytics } from '@/components/admin/ChatAnalytics'
import { DocumentManagement } from '@/components/admin/DocumentManagement'
import { BarChart3, FileText } from 'lucide-react'

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
      <h2 className="text-2xl font-bold">ChatPPC Admin Dashboard</h2>
      <p className={subtitle?.startsWith('Error:') ? 'text-destructive' : 'text-muted-foreground'}>
        {subtitle || 'Manage conversations and view chat analytics'}
      </p>
    </div>
  )

  if (loading) return <div className="space-y-6">{renderHeader('Loading...')}</div>
  if (error) return <div className="space-y-6">{renderHeader(`Error: ${error}`)}</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        {renderHeader()}
      </div>
      
      <Tabs defaultValue="analytics" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Chat Analytics
          </TabsTrigger>
          <TabsTrigger value="documents" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Document Management
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="analytics">
          <ChatAnalytics stats={stats} />
        </TabsContent>
        
        <TabsContent value="documents">
          <DocumentManagement />
        </TabsContent>
      </Tabs>
    </div>
  )
}