import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export function withAdminAuth(handler: (req: NextRequest, user: any) => Promise<NextResponse>) {
  return async function(req: NextRequest) {
    try {
      // Verify user is authenticated
      const authHeader = req.headers.get('authorization')
      
      if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'No authorization header' }, { status: 401 });
      }

      const token = authHeader.substring(7)
      
      // Verify the token with Supabase
      const authClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      
      const { data: { user }, error: authError } = await authClient.auth.getUser(token)
      
      if (authError || !user) {
        console.log('Auth failed:', authError?.message)
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
      }
      
      console.log('Auth successful for:', user.email)
      
      // Call the actual handler with authenticated user
      return handler(req, user)
      
    } catch (error: any) {
      console.error("Error in admin auth middleware:", error);
      return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
    }
  }
}