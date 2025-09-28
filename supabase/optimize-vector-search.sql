-- =============================================================================
-- Vector Search Optimization Script
-- =============================================================================
-- Creates HNSW and GIN indexes following Supabase recommendations
-- Based on: https://supabase.com/docs/guides/ai/vector-indexes/hnsw-indexes
-- To use this script, copy and paste it into the Supabase SQL editor.
-- This script needs to be run every time the documents table is dropped/recreated.
-- =============================================================================

-- Check current database status
SELECT 'Starting Vector Search Optimization' as status;

SELECT
    COUNT(*) as document_count,
    pg_size_pretty(pg_total_relation_size('documents')) as table_size
FROM documents;

SELECT
    vector_dims(embedding) as vector_dimensions
FROM documents
WHERE embedding IS NOT NULL
LIMIT 1;

-- Show existing indexes
SELECT
    'Current indexes on documents table' as info,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'documents'
ORDER BY indexname;

-- Create HNSW vector index
CREATE INDEX IF NOT EXISTS idx_documents_embedding_hnsw
ON documents
USING hnsw (embedding vector_cosine_ops);

-- Create GIN index for metadata filtering
CREATE INDEX IF NOT EXISTS idx_documents_metadata_gin
ON documents
USING gin (metadata);

-- Verify indexes were created successfully
SELECT
    'Vector Search Optimization Complete' as status,
    indexname,
    pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size,
    CASE
        WHEN indexname LIKE '%hnsw%' THEN 'Vector similarity index (main performance boost)'
        WHEN indexname LIKE '%gin%' THEN 'Metadata filtering index'
        ELSE 'Other index'
    END as purpose
FROM pg_indexes
WHERE tablename = 'documents'
ORDER BY indexname;