-- Vector Search Optimization
-- Creates HNSW and GIN indexes for better performance

-- Create HNSW vector index for similarity search
CREATE INDEX IF NOT EXISTS idx_documents_embedding_hnsw
ON documents
USING hnsw (embedding vector_cosine_ops);

-- Create GIN index for metadata filtering
CREATE INDEX IF NOT EXISTS idx_documents_metadata_gin
ON documents
USING gin (metadata);

-- Show created indexes
SELECT
    indexname,
    CASE
        WHEN indexname LIKE '%hnsw%' THEN 'Vector similarity index'
        WHEN indexname LIKE '%gin%' THEN 'Metadata filtering index'
        ELSE 'Other index'
    END as purpose
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'documents'
  AND (indexname LIKE '%hnsw%' OR indexname LIKE '%gin%')
ORDER BY indexname;