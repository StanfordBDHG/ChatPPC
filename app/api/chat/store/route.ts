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
    
    // Check if session exists
    const { data: sessionData, error: sessionError } = await client
      .from('chat_sessions')
      .select('id')
      .eq('id', sessionId)
      .single();
      
    if (sessionError && sessionError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      console.error("Error checking session:", sessionError);
      throw sessionError;
    }

    // Create session if it doesn't exist
    if (!sessionData) {
      console.log("Creating new session:", sessionId);
      const { error: createError } = await client
        .from('chat_sessions')
        .insert({ 
          id: sessionId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      
      if (createError) {
        console.error("Error creating session:", createError);
        throw createError;
      }
    } else {
      // Update the session's updated_at timestamp
      const { error: updateError } = await client
        .from('chat_sessions')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', sessionId);
      
      if (updateError) {
        console.error("Error updating session timestamp:", updateError);
        throw updateError;
      }
    }
    
    // Fetch existing messages to compare
    const { data: existingMessages, error: fetchError } = await client
      .from('chat_messages')
      .select('sequence_order')
      .eq('session_id', sessionId);
    
    if (fetchError) {
      console.error("Error fetching existing messages:", fetchError);
      throw fetchError;
    }

    // Create a Set of existing sequence orders for quick lookup
    const existingSequenceOrders = new Set(existingMessages?.map(m => m.sequence_order) || []);
    
    // Only insert messages that don't already exist
    const messagesToInsert = messages
      .map((msg: VercelChatMessage, index: number) => ({
        session_id: sessionId,
        role: msg.role,
        content: msg.content,
        tool_calls: msg.tool_calls || null,
        sequence_order: index,
        // Only set created_at for new messages
        created_at: existingSequenceOrders.has(index) ? undefined : new Date().toISOString()
      }))
      .filter(msg => !existingSequenceOrders.has(msg.sequence_order));

    if (messagesToInsert.length > 0) {
      const { error: insertError } = await client
        .from('chat_messages')
        .insert(messagesToInsert);
      
      if (insertError) {
        console.error("Error inserting messages:", insertError);
        throw insertError;
      }
    }
    
    // Update session's updated_at timestamp since we have new messages
    const { error: updateError } = await client
      .from('chat_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', sessionId);
    
    if (updateError) {
      console.error("Error updating session timestamp:", updateError);
      throw updateError;
    }
    
    return NextResponse.json({ success: true, sessionId });
  } catch (e: any) {
    console.error("Error in chat storage API:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
} 