import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { withAdminAuth } from "@/lib/adminAuth";

async function handleDeleteDocument(req: NextRequest, _user: any) {
  try {
    const body = await req.json();
    const { source } = body;
    
    if (!source) {
      return NextResponse.json(
        { error: "Document source is required" },
        { status: 400 }
      );
    }

    const client = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PRIVATE_KEY!,
    );

    // First, get count of chunks to be deleted
    const { count: chunkCount } = await client
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('metadata->>source', source);

    if (chunkCount === 0) {
      return NextResponse.json(
        { error: "No document found with that source name" },
        { status: 404 }
      );
    }

    // Delete all chunks with the specified source
    const { error } = await client
      .from('documents')
      .delete()
      .eq('metadata->>source', source);
    
    if (error) {
      throw new Error(`Failed to delete document: ${error.message}`);
    }

    return NextResponse.json({ 
      success: true, 
      message: `Successfully deleted ${chunkCount} chunk(s) for document: ${source}`,
      deletedChunks: chunkCount
    });

  } catch (error: any) {
    console.error('Delete error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleGetDocumentSources(req: NextRequest, _user: any) {
  try {
    const client = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PRIVATE_KEY!,
    );

    // Get unique document sources
    const { data, error } = await client
      .from('documents')
      .select('metadata')
      .not('metadata->source', 'is', null);

    if (error) {
      throw new Error(`Failed to fetch documents: ${error.message}`);
    }

    // Extract unique sources
    const sources = Array.from(new Set(
      data
        .map(doc => doc.metadata?.source)
        .filter(source => source)
        .sort()
    ));

    return NextResponse.json({ 
      success: true, 
      sources
    });

  } catch (error: any) {
    console.error('Fetch sources error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export const DELETE = withAdminAuth(handleDeleteDocument);
export const GET = withAdminAuth(handleGetDocumentSources);
