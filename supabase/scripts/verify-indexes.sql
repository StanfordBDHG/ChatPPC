-- Vector Search Performance Check
-- Combined report showing all optimization details

WITH
-- Database stats
db_stats AS (
    SELECT
        COUNT(*) as total_docs,
        COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) as docs_with_embeddings,
        pg_size_pretty(pg_total_relation_size('documents')) as table_size
    FROM documents
),
-- Index information
index_info AS (
    SELECT
        indexname,
        CASE
            WHEN indexname LIKE '%hnsw%' THEN '🎯 Vector Search'
            WHEN indexname LIKE '%gin%' THEN '🏷️ Metadata Filter'
            ELSE '❓ Other'
        END as purpose,
        pg_size_pretty(pg_relation_size(indexname::regclass)) as size,
        CASE
            WHEN EXISTS (
                SELECT 1 FROM pg_stat_user_indexes
                WHERE indexrelname = pg_indexes.indexname AND idx_scan > 0
            ) THEN '✅ Being Used'
            ELSE '⚠️ Not Used Yet'
        END as usage_status
    FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'documents'
      AND (indexname LIKE '%hnsw%' OR indexname LIKE '%gin%')
),
-- Performance test
perf_test AS (
    SELECT
        clock_timestamp() as start_time,
        (SELECT embedding FROM documents WHERE embedding IS NOT NULL LIMIT 1) as test_vector
),
perf_results AS (
    SELECT
        COUNT(*) as found_docs,
        ROUND(EXTRACT(milliseconds FROM (clock_timestamp() - pt.start_time))::numeric, 1) as speed_ms
    FROM perf_test pt,
    LATERAL match_documents(pt.test_vector, 5, '{}'::jsonb) md
    GROUP BY pt.start_time
)
-- Combined output
SELECT
    '📊 DATABASE STATUS' as "Section",
    'Documents: ' || ds.total_docs || ' total, ' || ds.docs_with_embeddings || ' with embeddings' as "Details",
    'Table size: ' || ds.table_size as "Extra Info"
FROM db_stats ds

UNION ALL

SELECT
    '🔍 INDEXES',
    ii.indexname || ' (' || ii.purpose || ')',
    ii.size || ' - ' || ii.usage_status
FROM index_info ii

UNION ALL

SELECT
    '⚡ SEARCH PERFORMANCE',
    'Found ' || pr.found_docs || ' results',
    'Speed: ' || pr.speed_ms || 'ms'
FROM perf_results pr

UNION ALL

SELECT
    '🧪 HNSW INDEX TEST',
    CASE
        WHEN EXISTS (
            SELECT 1 FROM pg_indexes
            WHERE indexname LIKE '%hnsw%' AND tablename = 'documents'
        ) THEN 'HNSW index exists and ready'
        ELSE 'HNSW index missing - run optimization script'
    END,
    'Testing vector similarity search capability'

UNION ALL

SELECT
    '💡 EXPLANATION',
    CASE
        WHEN ds.total_docs >= 100 THEN 'Large dataset - indexes used automatically'
        WHEN ds.total_docs >= 50 THEN 'Medium dataset - indexes may not always be used'
        ELSE 'Small dataset (' || ds.total_docs || ' docs) - sequential scan is faster'
    END,
    'This is normal PostgreSQL behavior'
FROM db_stats ds;

