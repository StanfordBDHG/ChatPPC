import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ensureUserId, withUserId } from "@/utils/userId";

export const runtime = "edge";

/**
 * This API endpoint logs when users click on links provided by the assistant
 */
export const POST = withUserId(async (req: NextRequest) => {
  try {
    const { sessionId, messageId, linkUrl, linkText } = await req.json();
    
    // Validate inputs
    if (!sessionId || !messageId || !linkUrl) {
      return NextResponse.json(
        { error: "Session ID, message ID, and link URL are required" }, 
        { status: 400 }
      );
    }
    
    // Get the user ID from cookie
    const userId = ensureUserId(req);
    
    const client = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PRIVATE_KEY!,
    );
    
    // Prepare insert data - basic fields first
    const clickData = {
      session_id: sessionId,
      message_id: messageId,
      link_url: linkUrl,
      link_text: linkText || null,
      clicked_at: new Date().toISOString()
    };
    
    try {
      // First try with user_id
      const { error, data } = await client
        .from('link_clicks')
        .insert({
          ...clickData,
          user_id: userId
        });
      
      if (error) {
        // If error mentions missing user_id column, try again without it
        if (error.message && error.message.includes("user_id")) {
          console.log("Retrying link click insert without user_id field");
          const { error: retryError } = await client
            .from('link_clicks')
            .insert(clickData);
            
          if (retryError) throw retryError;
        } else {
          throw error;
        }
      }
    } catch (dbError: any) {
      console.error("Database error:", dbError);
      // Just log the error but don't fail the response - this is non-critical
    }
    
    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("Error in link click logging API:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}); 