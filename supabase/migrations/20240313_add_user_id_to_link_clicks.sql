-- Add user_id column to link_clicks table
ALTER TABLE link_clicks 
ADD COLUMN IF NOT EXISTS user_id TEXT;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_link_clicks_user_id ON link_clicks(user_id); 