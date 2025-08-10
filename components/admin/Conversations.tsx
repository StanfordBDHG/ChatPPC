'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { ConversationDetail } from './ConversationDetail'
import { ChevronLeft, ChevronRight, Search, X, ExternalLink } from 'lucide-react'
import { fetchWithAuth, formatDate } from '@/lib/adminUtils'

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

interface LinkClickStats {
  mostClickedLinks: {
    url: string
    text: string
    clickCount: number
    lastClicked: string
  }[]
  totalClicks: number
  uniqueLinks: number
}

interface ConversationsProps {
  stats: Stats | null
}

export function Conversations({ stats }: ConversationsProps) {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 5,
    total: 0,
    pages: 0
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [linkClickStats, setLinkClickStats] = useState<LinkClickStats | null>(null)
  const [linkClicksLoading, setLinkClicksLoading] = useState(false)
  const [linkClicksPagination, setLinkClicksPagination] = useState({
    page: 1,
    limit: 5,
    total: 0,
    pages: 0
  })
  const [linkSearchQuery, setLinkSearchQuery] = useState('')
  const [currentLinkSearch, setCurrentLinkSearch] = useState('')

  const PAGE_SIZE_OPTIONS = [5, 10, 20, 50]

  const [currentSearch, setCurrentSearch] = useState('')

  const fetchConversations = useCallback(async (searchTerm?: string) => {
    setLoading(true)
    try {
      const search = searchTerm !== undefined ? searchTerm : currentSearch
      const searchParam = search.trim() ? `&search=${encodeURIComponent(search)}` : ''
      const data = await fetchWithAuth(`/api/admin/conversations?page=${pagination.page}&limit=${pagination.limit}${searchParam}`)
      setConversations(data.conversations)
      setPagination(data.pagination)
      setError(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [pagination.page, pagination.limit, currentSearch])

  const fetchLinkClickStats = useCallback(async (searchTerm?: string) => {
    setLinkClicksLoading(true)
    try {
      const search = searchTerm !== undefined ? searchTerm : currentLinkSearch
      const searchParam = search.trim() ? `&search=${encodeURIComponent(search)}` : ''
      const data = await fetchWithAuth(`/api/admin/link-clicks?page=${linkClicksPagination.page}&limit=${linkClicksPagination.limit}${searchParam}`)
      setLinkClickStats(data)
      setLinkClicksPagination(data.pagination)
    } catch (err: any) {
      console.error('Error fetching link click stats:', err)
    } finally {
      setLinkClicksLoading(false)
    }
  }, [linkClicksPagination.page, linkClicksPagination.limit, currentLinkSearch])

  useEffect(() => {
    fetchConversations()
    fetchLinkClickStats()
  }, [fetchConversations, fetchLinkClickStats])

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }))
  }

  const handlePageSizeChange = (newLimit: number) => {
    setPagination(prev => ({ ...prev, limit: newLimit, page: 1 }))
  }

  const handleLinkClicksPageChange = (newPage: number) => {
    setLinkClicksPagination(prev => ({ ...prev, page: newPage }))
  }

  const handleLinkClicksPageSizeChange = (newLimit: number) => {
    setLinkClicksPagination(prev => ({ ...prev, limit: newLimit, page: 1 }))
  }

  const handleLinkSearchChange = (value: string) => {
    setLinkSearchQuery(value)
    // Don't automatically reset pagination or fetch when typing
  }

  const handleLinkSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setCurrentLinkSearch(linkSearchQuery)
    setLinkClicksPagination(prev => ({ ...prev, page: 1 })) // Reset to page 1 when searching
    fetchLinkClickStats(linkSearchQuery)
  }

  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    // Don't automatically reset pagination or fetch when typing
  }

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setCurrentSearch(searchQuery)
    setPagination(prev => ({ ...prev, page: 1 })) // Reset to page 1 when searching
    fetchConversations(searchQuery)
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
            <h3 className="text-lg font-semibold text-foreground">{card.title}</h3>
            <p className="text-2xl font-bold mt-2 text-foreground">{card.value}</p>
            <p className="text-sm text-muted-foreground">{card.description}</p>
          </div>
        ))}
      </div>
      
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">Recent Conversations</h3>
        </div>
        
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4 flex-1">
            {/* Search Bar */}
            <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleSearchSubmit()
                    }
                  }}
                  className="w-64 pl-10 pr-10 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                  disabled={loading}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('')
                      setCurrentSearch('')
                      setPagination(prev => ({ ...prev, page: 1 }))
                      fetchConversations('')
                    }}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    disabled={loading}
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Button 
                type="button"
                variant="outline" 
                size="sm"
                disabled={loading}
                onClick={() => handleSearchSubmit()}
              >
                <Search className="h-4 w-4" />
              </Button>
            </form>
            
            {currentSearch && (
              <p className="text-sm text-muted-foreground">
                Searching for: &ldquo;{currentSearch}&rdquo; • {pagination.total} result{pagination.total !== 1 ? 's' : ''} found
              </p>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Show:</span>
              <select 
                value={pagination.limit}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                className="border border-input rounded px-2 py-1 text-sm bg-background min-w-[60px]"
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
              onClick={() => fetchConversations()}
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
                    <p className="font-medium text-foreground">Session {conversation.id.slice(0, 8)}</p>
                    <p className="text-sm text-muted-foreground mb-1">
                      {conversation.message_count} messages • Created: {formatDate(conversation.created_at)} • Last Updated: {formatDate(conversation.updated_at)}
                    </p>
                    {conversation.first_message && (
                      <p className="text-sm text-muted-foreground italic">
                        &ldquo;{conversation.first_message.content}&rdquo;
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                      Click to view
                    </span>
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

      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">Most Clicked Links</h3>
        </div>
        
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4 flex-1">
            {/* Search Bar */}
            <form onSubmit={handleLinkSearchSubmit} className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search links..."
                  value={linkSearchQuery}
                  onChange={(e) => handleLinkSearchChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleLinkSearchSubmit()
                    }
                  }}
                  className="w-64 pl-10 pr-10 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                  disabled={linkClicksLoading}
                />
                {linkSearchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setLinkSearchQuery('')
                      setCurrentLinkSearch('')
                      setLinkClicksPagination(prev => ({ ...prev, page: 1 }))
                      fetchLinkClickStats('')
                    }}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    disabled={linkClicksLoading}
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Button 
                type="button"
                variant="outline" 
                size="sm"
                disabled={linkClicksLoading}
                onClick={() => handleLinkSearchSubmit()}
              >
                <Search className="h-4 w-4" />
              </Button>
            </form>
            
            {currentLinkSearch && (
              <p className="text-sm text-muted-foreground">
                Searching for: &ldquo;{currentLinkSearch}&rdquo; • {linkClicksPagination.total} result{linkClicksPagination.total !== 1 ? 's' : ''} found
              </p>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Show:</span>
              <select 
                value={linkClicksPagination.limit}
                onChange={(e) => handleLinkClicksPageSizeChange(Number(e.target.value))}
                className="border border-input rounded px-2 py-1 text-sm bg-background min-w-[60px]"
                disabled={linkClicksLoading}
              >
                {PAGE_SIZE_OPTIONS.map(size => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => fetchLinkClickStats()}
              disabled={linkClicksLoading}
            >
              {linkClicksLoading ? 'Loading...' : 'Refresh'}
            </Button>
          </div>
        </div>
        
        {linkClicksLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading link statistics...
          </div>
        ) : linkClickStats && linkClickStats.mostClickedLinks.length > 0 ? (
          <>
            {/* Links Table */}
            <div className="overflow-x-auto mb-4">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium">Link Name</th>
                    <th className="text-left p-3 font-medium">URL</th>
                    <th className="text-left p-3 font-medium">Last Clicked</th>
                    <th className="text-right p-3 font-medium">Clicks</th>
                  </tr>
                </thead>
                <tbody>
                  {linkClickStats.mostClickedLinks.map((link) => (
                    <tr key={link.url} className="border-b hover:bg-accent/50">
                      <td className="p-3">
                        <a 
                          href={link.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-primary hover:text-primary/80 font-medium flex items-center gap-1"
                        >
                          {link.text}
                          <ExternalLink className="h-3 w-3 flex-shrink-0" />
                        </a>
                      </td>
                      <td className="p-3">
                        <span className="text-sm text-muted-foreground truncate max-w-xs block">
                          {link.url}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="text-sm text-muted-foreground">
                          {formatDate(link.lastClicked)}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <span className="font-bold text-green-600">
                          {link.clickCount}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Pagination Controls */}
            <div className="flex items-center justify-between border-t pt-4">
              <div className="text-sm text-muted-foreground">
                Showing {((linkClicksPagination.page - 1) * linkClicksPagination.limit) + 1} to {Math.min(linkClicksPagination.page * linkClicksPagination.limit, linkClicksPagination.total)} of {linkClicksPagination.total} links
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleLinkClicksPageChange(linkClicksPagination.page - 1)}
                  disabled={linkClicksPagination.page <= 1 || linkClicksLoading}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                
                <span className="text-sm font-medium px-3">
                  Page {linkClicksPagination.page} of {linkClicksPagination.pages}
                </span>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleLinkClicksPageChange(linkClicksPagination.page + 1)}
                  disabled={linkClicksPagination.page >= linkClicksPagination.pages || linkClicksLoading}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p>No link clicks recorded yet.</p>
            <p className="text-sm mt-2">
              Link clicks will appear here once users start clicking on links in chat responses.
            </p>
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