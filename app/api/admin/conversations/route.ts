import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { withAdminAuth } from "@/lib/adminAuth";


async function handleGetConversations(req: NextRequest, _user: any) {
  const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10')));
    const search = searchParams.get('search') || '';
    const offset = (page - 1) * limit;
    
    // Validate search input
    if (search.length > 1000) {
      return NextResponse.json({ error: 'Search query too long' }, { status: 400 });
    }
    
    const client = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PRIVATE_KEY!,
    );
    
    let conversationIds: string[] = [];
    
    if (search.trim()) {
      // Search for conversations containing the search text in messages
      // Using Supabase's safe parameterized query approach
      const searchTerm = search.trim();
      
      // Escape special SQL LIKE characters to prevent injection
      const escapedSearch = searchTerm
        .replace(/\\/g, '\\\\')  // Escape backslashes first
        .replace(/[%_]/g, '\\$&'); // Escape % and _ wildcard characters
      
      const { data: matchingMessages } = await client
        .from('chat_messages')
        .select('session_id')
        .ilike('content', `%${escapedSearch}%`);
      
      conversationIds = Array.from(new Set(matchingMessages?.map(m => m.session_id) || []));
      
      if (conversationIds.length === 0) {
        // No matching conversations found
        return NextResponse.json({
          conversations: [],
          pagination: {
            page,
            limit,
            total: 0,
            pages: 0,
          },
        });
      }
    }
    
    // Build the query for conversations
    let conversationsQuery = client
      .from('chat_sessions')
      .select(`
        id,
        created_at,
        updated_at,
        chat_messages(count)
      `)
      .order('updated_at', { ascending: false });
    
    // Apply search filter if we have matching conversation IDs
    if (search.trim() && conversationIds.length > 0) {
      conversationsQuery = conversationsQuery.in('id', conversationIds);
    }
    
    // Apply pagination
    const { data: conversations, error } = await conversationsQuery
      .range(offset, offset + limit - 1);
    
    if (error) throw error;
    
    // Get total count for pagination
    let totalCountQuery = client
      .from('chat_sessions')
      .select('*', { count: 'exact', head: true });
    
    if (search.trim() && conversationIds.length > 0) {
      totalCountQuery = totalCountQuery.in('id', conversationIds);
    }
    
    const { count: totalCount } = await totalCountQuery;
    
    // Get first user message for each conversation
    const resultConversationIds = conversations?.map(c => c.id) || [];
    const { data: firstMessages } = await client
      .from('chat_messages')
      .select('session_id, content, role')
      .in('session_id', resultConversationIds)
      .eq('role', 'user')
      .order('sequence_order', { ascending: true });
    
    // Create a map of session_id to first user message
    const firstMessageMap = new Map();
    firstMessages?.forEach(msg => {
      // Only set if we haven't seen this session_id yet (gets the first user message)
      if (!firstMessageMap.has(msg.session_id)) {
        firstMessageMap.set(msg.session_id, msg);
      }
    });
    
    // Format the response
    const formattedConversations = conversations?.map(session => {
      const firstMessage = firstMessageMap.get(session.id);
      return {
        id: session.id,
        created_at: session.created_at,
        updated_at: session.updated_at,
        message_count: session.chat_messages?.[0]?.count || 0,
        first_message: firstMessage ? {
          content: firstMessage.content.substring(0, 100) + (firstMessage.content.length > 100 ? '...' : ''),
          role: firstMessage.role
        } : null
      };
    }) || [];
    
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