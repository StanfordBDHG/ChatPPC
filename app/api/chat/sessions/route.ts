import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ensureUserId, withUserId } from "@/utils/userId";

export const runtime = "edge";

/**
 * This API endpoint retrieves chat sessions for the current user
 */
export const GET = withUserId(async (req: NextRequest) => {
  try {
    // Check if debug mode is requested
    const { searchParams } = new URL(req.url);
    const debug = searchParams.get('debug') === 'true';
    
    // Get the user ID from cookie
    const userId = ensureUserId(req);
    if (debug) console.log("Sessions API - Current user ID:", userId);
    
    const client = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PRIVATE_KEY!,
    );
    
    // For debugging, get all sessions if debug mode is enabled
    let allSessions = null;
    if (debug) {
      const { data } = await client
        .from('chat_sessions')
        .select('*');
      
      allSessions = data;
      console.log("All sessions:", allSessions);
      console.log("Looking for sessions with user_id:", userId);
    }
    
    // Get sessions for the current user ordered by most recent first
    const { data: sessions, error } = await client
      .from('chat_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });
      
    if (debug) console.log("Filtered sessions for user:", sessions);
      
    if (error) throw error;
    
    // Return different response based on debug mode
    if (debug) {
      return NextResponse.json({ 
        userId, 
        sessions,
        allSessions
      });
    } else {
      return NextResponse.json({ sessions });
    }
  } catch (e: any) {
    console.error("Error in sessions API:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}); 