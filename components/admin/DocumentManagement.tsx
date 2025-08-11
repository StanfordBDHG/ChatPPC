'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { DocumentDetail } from './DocumentDetail'
import { ChevronLeft, ChevronRight, Upload, X, Trash2, AlertTriangle } from 'lucide-react'
import { fetchWithAuth } from '@/lib/adminUtils'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface Document {
  id: number
  source: string
  title: string
  content: string
}

interface DocumentStats {
  documents: Document[]
  pagination: {
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
    limit: 5,
    total: 0,
    pages: 0
  })
  const [uploading, setUploading] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [deleting, setDeleting] = useState(false)
  const [selectedSourceForDelete, setSelectedSourceForDelete] = useState<string>('')
  const [documentSources, setDocumentSources] = useState<string[]>([])
  const [loadingSources, setLoadingSources] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [documentToDelete, setDocumentToDelete] = useState<string>('')

  const PAGE_SIZE_OPTIONS = [5, 10, 20, 50]

  const fetchDocuments = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchWithAuth(`/api/admin/documents?page=${pagination.page}&limit=${pagination.limit}`)
      setDocumentStats(data)
      setPagination(data.pagination)
      setError(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [pagination.page, pagination.limit])

  const fetchDocumentSources = useCallback(async () => {
    setLoadingSources(true)
    try {
      const data = await fetchWithAuth('/api/admin/documents/delete')
      setDocumentSources(data.sources || [])
    } catch (err: any) {
      console.error('Failed to fetch document sources:', err.message)
      setDocumentSources([])
    } finally {
      setLoadingSources(false)
    }
  }, [])

  useEffect(() => {
    fetchDocuments()
    fetchDocumentSources()
  }, [fetchDocuments, fetchDocumentSources])

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }))
  }

  const handlePageSizeChange = (newLimit: number) => {
    setPagination(prev => ({ ...prev, limit: newLimit, page: 1 }))
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files) {
      const fileArray = Array.from(files).filter(file => 
        file.name.endsWith('.md') || file.name.endsWith('.txt')
      )
      if (fileArray.length !== files.length) {
        toast.warning('Only .md and .txt files are supported')
      }
      setSelectedFiles(fileArray)
    }
  }

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      toast.error('Please select files to upload')
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      selectedFiles.forEach(file => {
        formData.append('files', file)
      })

      const response = await fetchWithAuth('/api/admin/documents/upload', {
        method: 'POST',
        body: formData
      })

      if (response.success) {
        toast.success(`Successfully uploaded ${response.successCount}/${response.totalFiles} files`)
        if (response.skippedCount > 0) {
          toast.info(`${response.skippedCount} files were skipped (unchanged)`)
        }
        if (response.errorCount > 0) {
          toast.error(`${response.errorCount} files failed to upload`)
        }
        
        // Clear selected files and refresh documents
        setSelectedFiles([])
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
        fetchDocuments()
      } else {
        throw new Error(response.error || 'Upload failed')
      }
    } catch (err: any) {
      toast.error(err.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteClick = () => {
    if (!selectedSourceForDelete) {
      toast.error('Please select a document to delete')
      return
    }
    setDocumentToDelete(selectedSourceForDelete)
    setShowDeleteModal(true)
  }

  const handleConfirmDelete = async () => {
    setDeleting(true)
    try {
      const response = await fetchWithAuth('/api/admin/documents/delete', {
        method: 'DELETE',
        body: JSON.stringify({ source: documentToDelete })
      })

      if (response.success) {
        toast.success(`Successfully deleted ${response.deletedChunks} chunk(s) for: ${documentToDelete}`)
        
        // Clear selection and refresh data
        setSelectedSourceForDelete('')
        setShowDeleteModal(false)
        setDocumentToDelete('')
        fetchDocuments()
        fetchDocumentSources()
      } else {
        throw new Error(response.error || 'Delete failed')
      }
    } catch (err: any) {
      toast.error(err.message || 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  const handleCancelDelete = () => {
    setShowDeleteModal(false)
    setDocumentToDelete('')
  }

  return (
    <div className="space-y-6">
      {/* File Upload and Delete Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* File Upload Section */}
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">Upload Documents</h3>
          </div>
          
          <div className="space-y-4">
            <div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".md,.txt"
                onChange={handleFileSelect}
                className="hidden"
                id="document-upload"
              />
              <label htmlFor="document-upload">
                <Button
                  variant="outline"
                  className="cursor-pointer"
                  disabled={uploading}
                  asChild
                >
                  <span className="flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    Select Files (.md, .txt)
                  </span>
                </Button>
              </label>
            </div>

            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-foreground">Selected Files:</h4>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between bg-accent/50 px-3 py-2 rounded">
                      <span className="text-sm text-foreground">{file.name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveFile(index)}
                        disabled={uploading}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="w-full"
                >
                  {uploading ? 'Uploading...' : `Upload ${selectedFiles.length} File${selectedFiles.length === 1 ? '' : 's'}`}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Delete Documents Section */}
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">Delete Documents</h3>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Select Document to Delete:</label>
              <select 
                value={selectedSourceForDelete}
                onChange={(e) => setSelectedSourceForDelete(e.target.value)}
                className="w-full border border-input rounded px-3 py-2 text-sm bg-background"
                disabled={deleting || loadingSources}
              >
                <option value="">
                  {loadingSources ? 'Loading documents...' : 'Choose a document...'}
                </option>
                {documentSources.map((source) => (
                  <option key={source} value={source}>
                    {source}
                  </option>
                ))}
              </select>
            </div>

            {selectedSourceForDelete && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded">
                <p className="text-sm text-destructive font-medium mb-2">⚠️ Warning</p>
                <p className="text-sm text-muted-foreground">
                  This will permanently delete all chunks for: <span className="font-medium">{selectedSourceForDelete}</span>
                </p>
              </div>
            )}

            <Button
              onClick={handleDeleteClick}
              disabled={deleting || !selectedSourceForDelete || loadingSources}
              variant="destructive"
              className="w-full"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Document
            </Button>
          </div>
        </div>
      </div>

      {/* Document List Section */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">Document Management</h3>
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
            {documentStats && documentStats.documents.length > 0 ? (
              <>
                <div className="space-y-3 mb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-foreground">Chunks</h4>
                      <span className="bg-primary/10 text-primary text-xs font-medium px-2 py-1 rounded-full">
                        {pagination.total}
                      </span>
                    </div>
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
                          <h5 className="font-medium mb-1 text-foreground">{doc.title}</h5>
                          {doc.source !== doc.title && (
                            <p className="text-sm text-muted-foreground mb-2">{doc.source}</p>
                          )}
                          <p className="text-sm text-muted-foreground mt-2">{doc.content}</p>
                        </div>
                        <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded ml-4">
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
          chunkId={selectedDocument.id.toString()}
          title={selectedDocument.title}
          onClose={() => setSelectedDocument(null)}
        />
      )}

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirm Document Deletion
            </DialogTitle>
            <DialogDescription className="pt-2">
              This action cannot be undone. This will permanently delete all chunks for the document:
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="font-medium text-foreground break-all">
                {documentToDelete}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                All associated document chunks will be permanently removed from the database.
              </p>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={handleCancelDelete}
              disabled={deleting}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="w-full sm:w-auto"
            >
              {deleting ? (
                'Deleting...'
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Permanently
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}