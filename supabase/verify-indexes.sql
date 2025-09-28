-- =============================================================================
-- Verify Vector Search Indexes Script
-- =============================================================================
-- Run this after optimize-vector-search.sql to confirm indexes are working
-- =============================================================================

-- 1. Check if indexes exist
SELECT
    'Index Status Check' as check_type,
    indexname,
    pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size,
    CASE
        WHEN indexname LIKE '%hnsw%' THEN 'Vector similarity index'
        WHEN indexname LIKE '%gin%' THEN 'Metadata filtering index'
        ELSE 'Other index'
    END as purpose
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'documents'
  AND (indexname LIKE '%hnsw%' OR indexname LIKE '%gin%')
ORDER BY indexname;

-- 2. Test vector search performance (run EXPLAIN to see if index is used)
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, metadata
FROM documents
ORDER BY embedding <-> (SELECT embedding FROM documents WHERE embedding IS NOT NULL LIMIT 1)
LIMIT 5;

-- 3. Check index usage statistics
SELECT
    schemaname,
    indexrelname as indexname,
    idx_scan as times_used,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public' AND relname = 'documents'
  AND (indexrelname LIKE '%hnsw%' OR indexrelname LIKE '%gin%');