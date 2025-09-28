-- Create a function to search for documents
CREATE OR REPLACE FUNCTION match_documents (
    query_embedding vector(1536),
    match_count int DEFAULT null,
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
BEGIN
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
        ORDER BY embedding <=> query_embedding
        LIMIT CASE
            WHEN filter = '{}' THEN match_count
            ELSE match_count * 2  -- Get more candidates when filtering
        END
    ) d
    WHERE d.metadata @> filter
    ORDER BY d.distance
    LIMIT match_count;
END;
$$; 