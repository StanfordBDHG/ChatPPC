-- Create link_clicks table
CREATE TABLE IF NOT EXISTS link_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  message_id TEXT NOT NULL,
  link_url TEXT NOT NULL,
  link_text TEXT,
  clicked_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key to chat_sessions table
ALTER TABLE link_clicks 
  ADD CONSTRAINT fk_link_clicks_session 
  FOREIGN KEY (session_id) 
  REFERENCES chat_sessions(id) 
  ON DELETE CASCADE;

-- Add indexes for better query performance
CREATE INDEX idx_link_clicks_session_id ON link_clicks(session_id);
CREATE INDEX idx_link_clicks_message_id ON link_clicks(message_id);

-- Set up row level security
ALTER TABLE link_clicks ENABLE ROW LEVEL SECURITY; 