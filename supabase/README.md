# Supabase Migrations

This directory contains SQL migrations for your Supabase database.

## Link Clicks Tracking

A new migration has been added to create a `link_clicks` table for tracking when users click on links provided by the assistant in the chat interface.

### Applying the Migration

You can apply this migration in one of the following ways:

1. **Using the Supabase CLI**:
   ```bash
   supabase db push
   ```

2. **Using the Supabase Dashboard**:
   - Go to your Supabase project dashboard
   - Click on "SQL Editor"
   - Create a new query
   - Copy and paste the contents of the migration file
   - Click "Run"

### Schema

The `link_clicks` table has the following structure:

| Column       | Type                    | Description                           |
|--------------|-------------------------|---------------------------------------|
| id           | UUID                    | Primary key (auto-generated)          |
| session_id   | UUID                    | Foreign key to chat_sessions          |
| message_id   | TEXT                    | ID of the message containing the link |
| link_url     | TEXT                    | URL of the clicked link               |
| link_text    | TEXT                    | Text content of the link (optional)   |
| clicked_at   | TIMESTAMP WITH TIME ZONE| When the link was clicked             |
| created_at   | TIMESTAMP WITH TIME ZONE| When the record was created           |

### Querying Link Clicks

You can query link clicks with SQL like:

```sql
-- Get all link clicks
SELECT * FROM link_clicks ORDER BY clicked_at DESC;

-- Get link clicks for a specific session
SELECT * FROM link_clicks WHERE session_id = 'your-session-id' ORDER BY clicked_at DESC;

-- Get most clicked links
SELECT link_url, COUNT(*) as click_count 
FROM link_clicks 
GROUP BY link_url 
ORDER BY click_count DESC;
``` 