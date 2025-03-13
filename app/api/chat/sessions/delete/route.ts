import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ensureUserId, withUserId } from "@/utils/userId";

export const runtime = "edge";

/**
 * This API endpoint deletes chat sessions for the current user
 * It can delete a single session or all sessions
 */
export const DELETE = withUserId(async (req: NextRequest) => {
  try {
    // Get the user ID from cookie
    const userId = ensureUserId(req);
    
    // Get the sessionId from query params
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');
    const deleteAll = searchParams.get('all') === 'true';
    
    console.log("Delete API - User ID:", userId, "Session ID:", sessionId, "Delete All:", deleteAll);
    
    const client = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PRIVATE_KEY!,
    );
    
    if (deleteAll) {
      // Delete all chat messages for this user's sessions
      const { data: userSessions } = await client
        .from('chat_sessions')
        .select('id')
        .eq('user_id', userId);
      
      if (userSessions && userSessions.length > 0) {
        const sessionIds = userSessions.map(session => session.id);
        
        // Delete chat messages for all user's sessions
        await client
          .from('chat_messages')
          .delete()
          .in('session_id', sessionIds);
        
        // Delete all user's sessions
        const { error } = await client
          .from('chat_sessions')
          .delete()
          .eq('user_id', userId);
          
        if (error) throw error;
      }
      
      return NextResponse.json({ success: true, message: "All sessions deleted" });
    } else if (sessionId) {
      // Verify the session belongs to this user
      const { data: session, error: sessionError } = await client
        .from('chat_sessions')
        .select('user_id')
        .eq('id', sessionId)
        .single();
      
      if (sessionError || !session) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }
      
      if (session.user_id !== userId) {
        return NextResponse.json({ 
          error: "You don't have permission to delete this session" 
        }, { status: 403 });
      }
      
      // Delete messages first (foreign key relationship)
      await client
        .from('chat_messages')
        .delete()
        .eq('session_id', sessionId);
      
      // Then delete the session
      const { error } = await client
        .from('chat_sessions')
        .delete()
        .eq('id', sessionId);
        
      if (error) throw error;
      
      return NextResponse.json({ success: true, message: "Session deleted" });
    } else {
      return NextResponse.json({ 
        error: "Either sessionId or all=true is required" 
      }, { status: 400 });
    }
  } catch (e: any) {
    console.error("Error in delete sessions API:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}); 