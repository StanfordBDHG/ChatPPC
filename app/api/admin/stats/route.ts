import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { withAdminAuth } from "@/lib/adminAuth";

// Remove edge runtime for better debugging
// export const runtime = "edge";

async function handleGetStats(_req: NextRequest, _user: any) {
  const client = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PRIVATE_KEY!,
  );
    
    // Get total conversations (sessions)
    const { count: totalConversations } = await client
      .from('chat_sessions')
      .select('*', { count: 'exact', head: true });
    
    // Get active sessions (sessions with activity in last 24 hours)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const { count: activeSessions } = await client
      .from('chat_sessions')
      .select('*', { count: 'exact', head: true })
      .gte('updated_at', yesterday.toISOString());
    
    // Get messages today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { count: messagesToday } = await client
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString());
    
    // Get average messages per session
    const { data: avgData } = await client.rpc('get_avg_messages_per_session');
    const averageLength = avgData || 0;
    
    return NextResponse.json({
      totalConversations: totalConversations || 0,
      activeSessions: activeSessions || 0,
      messagesToday: messagesToday || 0,
      averageLength: Math.round(averageLength * 100) / 100, // Round to 2 decimal places
    });
}

export const GET = withAdminAuth(handleGetStats);