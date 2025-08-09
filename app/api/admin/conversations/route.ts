import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { withAdminAuth } from "@/lib/adminAuth";


async function handleGetConversations(req: NextRequest, _user: any) {
  const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;
    
    const client = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PRIVATE_KEY!,
    );
    
    // Get conversations with message count
    const { data: conversations, error } = await client
      .from('chat_sessions')
      .select(`
        id,
        created_at,
        updated_at,
        chat_messages(count)
      `)
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (error) throw error;
    
    // Get total count for pagination
    const { count: totalCount } = await client
      .from('chat_sessions')
      .select('*', { count: 'exact', head: true });
    
    // Format the response
    const formattedConversations = conversations?.map(session => ({
      id: session.id,
      created_at: session.created_at,
      updated_at: session.updated_at,
      message_count: session.chat_messages?.[0]?.count || 0,
    })) || [];
    
    return NextResponse.json({
      conversations: formattedConversations,
      pagination: {
        page,
        limit,
        total: totalCount || 0,
        pages: Math.ceil((totalCount || 0) / limit),
      },
    });
}

export const GET = withAdminAuth(handleGetConversations);