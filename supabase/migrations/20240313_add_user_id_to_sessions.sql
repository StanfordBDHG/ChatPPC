-- Add user_id column to chat_sessions table
ALTER TABLE chat_sessions 
ADD COLUMN IF NOT EXISTS user_id TEXT;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);

-- Update the row level security if needed
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY; 