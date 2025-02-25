import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "edge";

/**
 * This API endpoint retrieves all chat sessions
 */
export async function GET(req: NextRequest) {
  try {
    const client = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PRIVATE_KEY!,
    );
    
    // Get sessions ordered by most recent first
    const { data: sessions, error } = await client
      .from('chat_sessions')
      .select('*')
      .order('updated_at', { ascending: false });
      
    if (error) throw error;
    
    return NextResponse.json({ sessions });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
} 