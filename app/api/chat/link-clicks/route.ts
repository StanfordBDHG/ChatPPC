import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "edge";

/**
 * This API endpoint logs when users click on links provided by the assistant
 */
export async function POST(req: NextRequest) {
  try {
    const { sessionId, messageId, linkUrl, linkText } = await req.json();
    
    // Validate inputs
    if (!sessionId || !messageId || !linkUrl) {
      return NextResponse.json(
        { error: "Session ID, message ID, and link URL are required" }, 
        { status: 400 }
      );
    }
    
    const client = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PRIVATE_KEY!,
    );
    
    // Log the link click
    const { error, data } = await client
      .from('link_clicks')
      .insert({
        session_id: sessionId,
        message_id: messageId,
        link_url: linkUrl,
        link_text: linkText || null,
        clicked_at: new Date().toISOString()
      });
    
    if (error) {
      console.error("Database error:", error);
      throw error;
    }
    
    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("Error in link click logging API:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
} 