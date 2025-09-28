-- Create a function to search for documents
CREATE OR REPLACE FUNCTION match_documents (
    query_embedding vector(1536),
    match_count int DEFAULT 5,
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
    _match_count int := COALESCE(match_count, 5);
    _filter jsonb := COALESCE(filter, '{}'::jsonb);
    _candidate_limit int;
BEGIN
    -- Input validation
    IF query_embedding IS NULL THEN
        RAISE EXCEPTION 'query_embedding cannot be NULL';
    END IF;

    IF _match_count <= 0 THEN
        RAISE EXCEPTION 'match_count must be positive, got: %', _match_count;
    END IF;

    -- Calculate candidate limit for filtering
    _candidate_limit := CASE
        WHEN _filter = '{}'::jsonb THEN _match_count
        ELSE GREATEST(_match_count * 2, 20)  -- Ensure minimum candidates
    END;

    RETURN QUERY
    SELECT
        d.id,
        d.content,
        d.metadata,
        (d.embedding::text)::jsonb as embedding,
        1 - d.distance as similarity
    FROM (
        SELECT
            id,
            content,
            metadata,
            embedding,
            embedding <=> query_embedding as distance
        FROM documents
        WHERE embedding IS NOT NULL
        ORDER BY embedding <=> query_embedding
        LIMIT _candidate_limit
    ) d
    WHERE d.metadata @> _filter
    ORDER BY d.distance
    LIMIT _match_count;
END;
$$; 