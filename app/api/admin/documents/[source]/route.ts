import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { withAdminAuth } from "@/lib/adminAuth";

async function handleGetDocumentChunks(req: NextRequest, _user: any, { params }: { params: { source: string } }) {
  const client = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PRIVATE_KEY!,
  );
  
  try {
    const source = decodeURIComponent(params.source);
    
    // Get all chunks for this specific document source
    const { data: chunks, error } = await client
      .from('documents')
      .select('id, content, metadata')
      .eq('metadata->>source', source)
      .order('id', { ascending: true });
    
    if (error) {
      throw error;
    }

    // If no chunks found with metadata.source, try with metadata.title
    let allChunks = chunks;
    if (!chunks || chunks.length === 0) {
      const { data: titleChunks, error: titleError } = await client
        .from('documents')
        .select('id, content, metadata')
        .eq('metadata->>title', source)
        .order('id', { ascending: true });
      
      if (titleError) {
        throw titleError;
      }
      allChunks = titleChunks;
    }

    const documentDetail = {
      source,
      chunkCount: allChunks?.length || 0,
      chunks: allChunks?.map((chunk, index) => ({
        id: String(chunk.id),
        chunkIndex: index + 1,
        content: chunk.content || '',
        metadata: chunk.metadata || {}
      })) || []
    };

    return NextResponse.json(documentDetail);
  } catch (error: any) {
    console.error('Error fetching document chunks:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch document chunks' }, 
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest, context: { params: { source: string } }) {
  return withAdminAuth((req: NextRequest, user: any) => handleGetDocumentChunks(req, user, context))(req);
}