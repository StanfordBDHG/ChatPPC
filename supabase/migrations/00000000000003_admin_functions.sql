-- Function to calculate average messages per session
CREATE OR REPLACE FUNCTION get_avg_messages_per_session()
RETURNS NUMERIC AS $$
BEGIN
    RETURN (
        SELECT COALESCE(AVG(message_counts.count), 0)
        FROM (
            SELECT COUNT(*) as count
            FROM chat_messages
            GROUP BY session_id
        ) as message_counts
    );
END;
$$ LANGUAGE plpgsql;