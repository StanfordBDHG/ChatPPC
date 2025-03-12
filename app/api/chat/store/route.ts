import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Message as VercelChatMessage } from "ai";

export const runtime = "edge";

/**
 * This API endpoint handles storing chat messages in the database
 */
export async function POST(req: NextRequest) {  
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
    
    const client = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PRIVATE_KEY!,
    );
    
    // Check if session exists, create if not
    const { data: sessionData } = await client
      .from('chat_sessions')
      .select('id')
      .eq('id', sessionId)
      .single();
      
    if (!sessionData) {
      await client.from('chat_sessions').insert({ id: sessionId });
    } else {
      // Update the session's updated_at timestamp
      await client
        .from('chat_sessions')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', sessionId);
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
} 