'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { DocumentDetail } from './DocumentDetail'

interface Document {
  source: string
  title: string
  chunkCount: number
}

interface DocumentStats {
  totalDocuments: number
  totalChunks: number
  documents: Document[]
}

export function DocumentManagement() {
  const [documentStats, setDocumentStats] = useState<DocumentStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null)

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
    try {
      const data = await fetchWithAuth('/api/admin/documents')
      setDocumentStats(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])


  if (loading) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Document Management</h3>
          <p className="text-muted-foreground">Loading documents...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Document Management</h3>
          <p className="text-destructive">Error: {error}</p>
          <Button onClick={fetchDocuments} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Document Management</h3>
          <Button onClick={fetchDocuments} variant="outline" size="sm">
            Refresh
          </Button>
        </div>
        
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <div className="rounded-lg border bg-background p-4">
            <h4 className="font-medium">Total Documents</h4>
            <p className="text-2xl font-bold mt-1">{documentStats?.totalDocuments || 0}</p>
          </div>
          <div className="rounded-lg border bg-background p-4">
            <h4 className="font-medium">Total Chunks</h4>
            <p className="text-2xl font-bold mt-1">{documentStats?.totalChunks || 0}</p>
          </div>
          <div className="rounded-lg border bg-background p-4">
            <h4 className="font-medium">Storage Status</h4>
            <p className="text-sm font-medium mt-1 text-green-600">Active</p>
          </div>
        </div>

        {documentStats && documentStats.documents.length > 0 ? (
          <div className="space-y-3">
            <h4 className="font-medium">Document List</h4>
            {documentStats.documents.map((doc) => (
              <div 
                key={doc.source} 
                className="border rounded-lg p-4 hover:bg-accent/50 transition-colors cursor-pointer"
                onClick={() => setSelectedDocument(doc)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h5 className="font-medium mb-1">{doc.title}</h5>
                    {doc.source !== doc.title && (
                      <p className="text-sm text-muted-foreground mb-2">{doc.source}</p>
                    )}
                  </div>
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded ml-4">
                    {doc.chunkCount} chunks
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p>No documents found in the database.</p>
            <p className="text-sm mt-2">
              Documents will appear here once they are ingested through the system.
            </p>
          </div>
        )}
      </div>

      {selectedDocument && (
        <DocumentDetail 
          source={selectedDocument.source}
          title={selectedDocument.title}
          onClose={() => setSelectedDocument(null)}
        />
      )}
    </div>
  )
}