'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

interface DocumentChunk {
  id: string
  chunkIndex: number
  content: string
  metadata: any
}

interface DocumentDetail {
  source: string
  chunkCount: number
  chunks: DocumentChunk[]
}

interface DocumentDetailProps {
  source: string
  title: string
  onClose: () => void
}

export function DocumentDetail({ source, title, onClose }: DocumentDetailProps) {
  const [documentDetail, setDocumentDetail] = useState<DocumentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchDocumentDetail()
  }, [source])

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

  const fetchDocumentDetail = async () => {
    try {
      const encodedSource = encodeURIComponent(source)
      const data = await fetchWithAuth(`/api/admin/documents/${encodedSource}`)
      setDocumentDetail(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Document Details</h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p>Loading document chunks...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Document Details</h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-destructive">Error: {error}</p>
          <Button onClick={fetchDocumentDetail} className="mt-4">
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
            <h2 className="text-xl font-semibold">{title}</h2>
            {source !== title && (
              <p className="text-sm text-muted-foreground">{source}</p>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="mb-4 p-4 bg-muted rounded-lg">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <strong>Total Chunks:</strong> {documentDetail?.chunkCount || 0}
            </div>
            <div>
              <strong>Total Characters:</strong> {documentDetail?.chunks.reduce((total, chunk) => total + chunk.content.length, 0).toLocaleString()}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4">
          <h3 className="font-medium sticky top-0 bg-white py-2">Document Chunks</h3>
          {documentDetail?.chunks.map((chunk) => (
            <div key={chunk.id} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-blue-600">
                  Chunk {chunk.chunkIndex}
                </span>
                <span className="text-xs font-mono bg-muted px-2 py-1 rounded">
                  ID: {chunk.id.slice(0, 8)}
                </span>
              </div>
              
              <div className="text-sm leading-relaxed mb-3 whitespace-pre-wrap">
                {chunk.content}
              </div>
              
              {chunk.metadata && Object.keys(chunk.metadata).length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                    View Metadata
                  </summary>
                  <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-x-auto">
                    {JSON.stringify(chunk.metadata, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}