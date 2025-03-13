-- Add hidden column to chat_sessions table
ALTER TABLE chat_sessions ADD COLUMN hidden BOOLEAN DEFAULT false;

-- Create an index on the hidden column for faster filtering
CREATE INDEX idx_chat_sessions_hidden ON chat_sessions(hidden);

-- Create an index on user_id and hidden for common query pattern
CREATE INDEX idx_chat_sessions_user_hidden ON chat_sessions(user_id, hidden); 