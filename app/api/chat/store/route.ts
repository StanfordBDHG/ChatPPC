import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Message as VercelChatMessage } from "ai";
import { ensureUserId, withUserId } from "@/utils/userId";

export const runtime = "edge";

/**
 * This API endpoint handles storing chat messages in the database
 */
export const POST = withUserId(async (req: NextRequest) => {  
  try {
    const { sessionId, messages } = await req.json();    
    // Validate inputs
    if (!sessionId) {
      console.error("No session ID provided");
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
    }
    
    if (!Array.isArray(messages) || messages.length === 0) {
      console.error("Messages validation failed", { isArray: Array.isArray(messages), length: messages?.length });
      return NextResponse.json({ error: "Messages are required and must be an array" }, { status: 400 });
    }
    
    // Get the user ID from cookie
    const userId = ensureUserId(req);
    console.log("Store API - User ID from cookie:", userId);
    console.log("Store API - Session ID:", sessionId);
    
    const client = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PRIVATE_KEY!,
    );
    
    // Check if session exists, create if not
    const { data: sessionData } = await client
      .from('chat_sessions')
      .select('id, user_id')
      .eq('id', sessionId)
      .single();
      
    if (!sessionData) {
      try {
        // Create new session with current user ID
        await client.from('chat_sessions').insert({ 
          id: sessionId,
          user_id: userId
        });
      } catch (insertError: any) {
        console.error("Error inserting session with user_id:", insertError.message);
        // If user_id column doesn't exist, try without it
        if (insertError.message && insertError.message.includes("user_id")) {
          await client.from('chat_sessions').insert({ id: sessionId });
        } else {
          throw insertError;
        }
      }
    } else {
      try {
        // Only update if:
        // 1. The session belongs to this user already, OR
        // 2. The session has no user_id (legacy session)
        if (!sessionData.user_id || sessionData.user_id === userId) {
          await client
            .from('chat_sessions')
            .update({ 
              updated_at: new Date().toISOString(),
              user_id: userId  // Ensure user_id is set
            })
            .eq('id', sessionId);
        } else {
          // This session belongs to another user!
          console.error("Attempt to modify a session belonging to another user");
          return NextResponse.json({ 
            error: "You don't have permission to modify this chat session" 
          }, { status: 403 });
        }
      } catch (updateError: any) {
        console.error("Error updating session with user_id:", updateError.message);
        // If user_id column doesn't exist, just update timestamp
        if (updateError.message && updateError.message.includes("user_id")) {
          await client
            .from('chat_sessions')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', sessionId);
        } else {
          throw updateError;
        }
      }
    }
    
    // First, delete existing messages for this session to avoid duplicates
    await client
      .from('chat_messages')
      .delete()
      .eq('session_id', sessionId);
    
    // Store messages
    const messagesToInsert = messages.map((msg: VercelChatMessage, index: number) => ({
      session_id: sessionId,
      role: msg.role,
      content: msg.content,
      tool_calls: msg.tool_calls || null,
      sequence_order: index
    }));
    
    const { error, data } = await client
      .from('chat_messages')
      .insert(messagesToInsert);
    
    if (error) {
      console.error("Database error:", error);
      throw error;
    }
    
    return NextResponse.json({ success: true, sessionId });
  } catch (e: any) {
    console.error("Error in chat storage API:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}); 