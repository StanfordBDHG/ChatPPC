-- Enable the pgvector extension to work with embedding vectors
CREATE EXTENSION IF NOT EXISTS vector;

-- Drop existing function first
DROP FUNCTION IF EXISTS match_documents;

-- Drop existing tables
DROP TABLE IF EXISTS link_clicks;
DROP TABLE IF EXISTS chat_messages;
DROP TABLE IF EXISTS chat_sessions;
DROP TABLE IF EXISTS documents;

-- Create tables in order of dependencies
CREATE TABLE chat_sessions (
    id UUID PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES chat_sessions(id),
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    tool_calls JSONB,
    sequence_order INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE link_clicks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES chat_sessions(id),
    message_id UUID REFERENCES chat_messages(id),
    link_url TEXT NOT NULL,
    link_text TEXT,
    clicked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE documents (
    id BIGSERIAL PRIMARY KEY,
    content TEXT,
    metadata JSONB,
    embedding vector(1536)
);

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
        id,
        content,
        metadata,
        (embedding::text)::jsonb as embedding,
        1 - (documents.embedding <=> query_embedding) as similarity
    FROM documents
    WHERE metadata @> filter
    ORDER BY documents.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Insert sample data
INSERT INTO chat_sessions (id, created_at, updated_at)
VALUES 
    ('123e4567-e89b-12d3-a456-426614174000', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO chat_messages (session_id, role, content, sequence_order)
VALUES 
    ('123e4567-e89b-12d3-a456-426614174000', 'user', 'Hello, how are you?', 0),
    ('123e4567-e89b-12d3-a456-426614174000', 'assistant', 'I am doing well, thank you for asking! How can I help you today?', 1);

INSERT INTO link_clicks (session_id, message_id, link_url, link_text)
VALUES 
    ('123e4567-e89b-12d3-a456-426614174000', 
     (SELECT id FROM chat_messages WHERE session_id = '123e4567-e89b-12d3-a456-426614174000' AND sequence_order = 1),
     'https://med.stanford.edu/ppc.html',
     'PPC Website');

INSERT INTO documents (content, metadata)
VALUES 
    ('This is a sample document about patient care resources at Gardner Packard Children''s Health Center.',
     '{"source": "sample.md", "title": "Sample Document"}'); 