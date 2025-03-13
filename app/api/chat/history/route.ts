import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ensureUserId, withUserId } from "@/utils/userId";

export const runtime = "edge";

/**
 * This API endpoint retrieves chat message history for a specific session
 * Only returns messages if the session belongs to the current user
 */
export const GET = withUserId(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');
    
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }
    
    // Get the user ID from cookie
    const userId = ensureUserId(req);
    console.log("History API - User ID:", userId, "Session ID:", sessionId);
    
    const client = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PRIVATE_KEY!,
    );
    
    // First, verify this session belongs to the current user
    const { data: sessionData, error: sessionError } = await client
      .from('chat_sessions')
      .select('user_id')
      .eq('id', sessionId)
      .single();
    
    if (sessionError) {
      // If not found, return 404
      if (sessionError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }
      throw sessionError;
    }
    
    // If session has a user_id and it doesn't match current user, deny access
    if (sessionData.user_id && sessionData.user_id !== userId) {
      console.log(`Access denied: Session belongs to ${sessionData.user_id}, but request is from ${userId}`);
      return NextResponse.json({ 
        error: 'You do not have permission to access this chat session' 
      }, { status: 403 });
    }
    
    // If we get here, either:
    // 1. The session belongs to this user, OR
    // 2. The session has no user_id (legacy session)
    
    // In either case, let's update it to belong to current user if it doesn't already
    if (!sessionData.user_id) {
      await client
        .from('chat_sessions')
        .update({ user_id: userId })
        .eq('id', sessionId);
    }
    
    const { data: messages, error } = await client
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('sequence_order', { ascending: true });
      
    if (error) throw error;
    
    // Transform DB format to Vercel Chat Message format
    const formattedMessages = messages.map(msg => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      tool_calls: msg.tool_calls,
    }));
    
    return NextResponse.json({ messages: formattedMessages });
  } catch (e: any) {
    console.error("Error fetching chat history:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}); 