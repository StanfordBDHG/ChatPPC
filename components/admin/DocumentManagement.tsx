'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { DocumentDetail } from './DocumentDetail'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Document {
  id: number
  source: string
  title: string
  content: string
  metadata?: Record<string, any>
  chunkCount: number
}

interface DocumentStats {
  totalDocuments: number
  totalChunks: number
  documents: Document[]
  pagination?: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export function DocumentManagement() {
  const [documentStats, setDocumentStats] = useState<DocumentStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  })

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

  const fetchDocuments = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchWithAuth(`/api/admin/documents?page=${pagination.page}&limit=${pagination.limit}`)
      setDocumentStats(data)
      if (data.pagination) {
        setPagination(data.pagination)
      }
      setError(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [pagination.page, pagination.limit])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }))
  }

  const handlePageSizeChange = (newLimit: number) => {
    setPagination(prev => ({ ...prev, limit: newLimit, page: 1 }))
  }


  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Document Management</h3>
        </div>
        
        {loading && !documentStats && (
          <div className="text-center py-8 text-muted-foreground">
            Loading documents...
          </div>
        )}
        
        {error && !loading && (
          <div className="text-center py-8">
            <p className="text-destructive mb-4">Error: {error}</p>
            <Button onClick={fetchDocuments} variant="outline">
              Retry
            </Button>
          </div>
        )}
        
        {!loading && !error && (
          <>
            <div className="grid gap-4 md:grid-cols-3 mb-6">
              <div className="rounded-lg border bg-background p-4">
                <h4 className="font-medium">Total Chunks</h4>
                <p className="text-2xl font-bold mt-1">{documentStats?.totalDocuments || 0}</p>
              </div>
              <div className="rounded-lg border bg-background p-4">
                <h4 className="font-medium">Database Entries</h4>
                <p className="text-2xl font-bold mt-1">{documentStats?.totalChunks || 0}</p>
              </div>
              <div className="rounded-lg border bg-background p-4">
                <h4 className="font-medium">Storage Status</h4>
                <p className="text-sm font-medium mt-1 text-green-600">Active</p>
              </div>
            </div>

            {documentStats && documentStats.documents.length > 0 ? (
              <>
                <div className="space-y-3 mb-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Document Chunks</h4>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Show:</span>
                      <select 
                        value={pagination.limit}
                        onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                        className="border border-gray-300 rounded px-2 py-1 text-sm bg-white min-w-[60px]"
                        disabled={loading}
                      >
                        {PAGE_SIZE_OPTIONS.map(size => (
                          <option key={size} value={size}>{size}</option>
                        ))}
                      </select>
                      <Button 
                        onClick={fetchDocuments} 
                        variant="outline" 
                        size="sm"
                        disabled={loading}
                      >
                        {loading ? 'Loading...' : 'Refresh'}
                      </Button>
                    </div>
                  </div>
                  {documentStats.documents.map((doc) => (
                    <div 
                      key={doc.id} 
                      className="border rounded-lg p-4 hover:bg-accent/50 transition-colors cursor-pointer"
                      onClick={() => setSelectedDocument(doc)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h5 className="font-medium mb-1">{doc.title}</h5>
                          {doc.source !== doc.title && (
                            <p className="text-sm text-muted-foreground mb-2">{doc.source}</p>
                          )}
                          <p className="text-sm text-muted-foreground mt-2">{doc.content}</p>
                        </div>
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded ml-4">
                          ID: {doc.id}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Pagination Controls */}
                <div className="flex items-center justify-between border-t pt-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} document chunks
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
                <p>No document chunks found in the database.</p>
                <p className="text-sm mt-2">
                  Document chunks will appear here once they are ingested through the system.
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {selectedDocument && (
        <DocumentDetail 
          id={selectedDocument.id}
          source={selectedDocument.source}
          title={selectedDocument.title}
          onClose={() => setSelectedDocument(null)}
        />
      )}
    </div>
  )
}