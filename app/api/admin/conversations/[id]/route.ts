import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { withAdminAuth } from "@/lib/adminAuth";

async function handleGetConversation(req: NextRequest, _user: any, { params }: { params: { id: string } }) {
  const conversationId = params.id;
  
  const client = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PRIVATE_KEY!,
  );
  
  // Get conversation details
  const { data: session, error: sessionError } = await client
    .from('chat_sessions')
    .select('*')
    .eq('id', conversationId)
    .single();
  
  if (sessionError || !session) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  }
  
  // Get all messages for this conversation
  const { data: messages, error: messagesError } = await client
    .from('chat_messages')
    .select('*')
    .eq('session_id', conversationId)
    .order('sequence_order', { ascending: true });
  
  if (messagesError) {
    return NextResponse.json({ error: messagesError.message }, { status: 500 });
  }
  
  // Transform messages to match expected format
  const formattedMessages = messages?.map(msg => ({
    id: msg.id,
    role: msg.role,
    content: msg.content,
    tool_calls: msg.tool_calls,
    sequence_order: msg.sequence_order,
    created_at: msg.created_at,
  })) || [];
  
  return NextResponse.json({
    session: {
      id: session.id,
      created_at: session.created_at,
      updated_at: session.updated_at,
    },
    messages: formattedMessages,
    messageCount: formattedMessages.length,
  });
}

export const GET = withAdminAuth(handleGetConversation);