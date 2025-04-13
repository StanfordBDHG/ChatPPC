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