import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "edge";

/**
 * This API endpoint retrieves chat message history for a specific session
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');
    
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }
    
    const client = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PRIVATE_KEY!,
    );
    
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
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
} 