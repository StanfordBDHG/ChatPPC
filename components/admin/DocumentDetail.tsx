'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { fetchWithAuth } from '@/lib/adminUtils'

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

  const fetchDocumentDetail = useCallback(async () => {
    try {
      // Use source endpoint to get all chunks for this document
      const data = await fetchWithAuth(`/api/admin/documents/${encodeURIComponent(source)}`)
      setDocumentDetail(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [source])

  useEffect(() => {
    fetchDocumentDetail()
  }, [fetchDocumentDetail])

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
        <div className="bg-background rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-foreground">Chunk Details</h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p>Loading chunk details...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
        <div className="bg-background rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-foreground">Chunk Details</h2>
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
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-background rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground">{title}</h2>
            {source !== title && (
              <p className="text-sm text-muted-foreground">{source}</p>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="mb-4 p-4 bg-muted rounded-lg">
          <div className="grid grid-cols-2 gap-4 text-sm mb-3">
            <div>
              <strong>Chunk ID:</strong> {documentDetail?.chunks[0]?.id || 'N/A'}
            </div>
            <div>
              <strong>Content Length:</strong> {documentDetail?.chunks[0]?.content.length.toLocaleString() || 0} characters
            </div>
          </div>
          {documentDetail?.chunks[0]?.metadata && Object.keys(documentDetail.chunks[0].metadata).length > 0 && (
            <div className="border-t border-muted-foreground/20 pt-3">
              <div className="flex flex-wrap gap-2">
                {Object.entries(documentDetail.chunks[0].metadata).map(([key, value]) => (
                  <span key={key} className="text-xs bg-background border px-2 py-1 rounded">
                    <strong>{key}:</strong> {
                      typeof value === 'object' && value !== null 
                        ? JSON.stringify(value)
                        : String(value)
                    }
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto space-y-4">
          <h3 className="font-medium sticky top-0 bg-background py-2 text-foreground">Content</h3>
          {documentDetail?.chunks.map((chunk) => (
            <div key={chunk.id} className="border rounded-lg p-4">
              <div className="text-sm leading-relaxed prose prose-sm prose-slate dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {chunk.content}
                </ReactMarkdown>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}