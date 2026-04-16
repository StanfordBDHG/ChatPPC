-- Hybrid search: combines vector similarity with keyword matching.
-- This ensures that queries like "low hemoglobin" match documents
-- containing the word "hemoglobin" even if the embedding similarity
-- is not in the top results.

CREATE OR REPLACE FUNCTION hybrid_search (
    query_embedding vector(1536),
    query_text text DEFAULT '',
    match_count int DEFAULT 10,
    filter jsonb DEFAULT '{}'
) RETURNS TABLE (
    id bigint,
    content text,
    metadata jsonb,
    embedding jsonb,
    similarity float
)
LANGUAGE plpgsql
AS $$
#variable_conflict use_column
DECLARE
    _match_count int := COALESCE(match_count, 10);
    _filter jsonb := COALESCE(filter, '{}'::jsonb);
    _query_text text := COALESCE(query_text, '');
BEGIN
    IF query_embedding IS NULL THEN
        RAISE EXCEPTION 'query_embedding cannot be NULL';
    END IF;

    IF _match_count <= 0 THEN
        RAISE EXCEPTION 'match_count must be positive, got: %', _match_count;
    END IF;

    RETURN QUERY
    WITH
    -- Vector similarity search: get top candidates by embedding distance
    vector_results AS (
        SELECT
            d.id,
            d.content,
            d.metadata,
            d.embedding,
            1 - (d.embedding <=> query_embedding) as vector_score
        FROM documents d
        WHERE d.embedding IS NOT NULL
          AND d.metadata @> _filter
        ORDER BY d.embedding <=> query_embedding
        LIMIT _match_count * 4  -- oversample for reranking
    ),
    -- Keyword search: boost documents that contain query terms
    keyword_boost AS (
        SELECT
            vr.id,
            CASE
                WHEN _query_text = '' THEN 0.0
                WHEN vr.content ILIKE '%' || _query_text || '%' THEN 0.15
                ELSE (
                    -- Check individual words from the query
                    SELECT COALESCE(
                        0.05 * COUNT(*)::float / GREATEST(array_length(string_to_array(_query_text, ' '), 1), 1),
                        0.0
                    )
                    FROM unnest(string_to_array(_query_text, ' ')) AS word
                    WHERE length(word) > 2
                      AND vr.content ILIKE '%' || word || '%'
                )
            END as keyword_score
        FROM vector_results vr
    )
    SELECT
        vr.id,
        vr.content,
        vr.metadata,
        (vr.embedding::text)::jsonb as embedding,
        (vr.vector_score + kb.keyword_score)::float as similarity
    FROM vector_results vr
    JOIN keyword_boost kb ON vr.id = kb.id
    ORDER BY (vr.vector_score + kb.keyword_score) DESC
    LIMIT _match_count;
END;
$$;
