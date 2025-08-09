import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { withAdminAuth } from "@/lib/adminAuth";

async function handleGetDocumentChunks(req: NextRequest, _user: any, { params }: { params: Promise<{ source: string }> }) {
  const client = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PRIVATE_KEY!,
  );
  
  try {
    const { source: rawSource } = await params;
    const identifier = decodeURIComponent(rawSource);
    
    // Check if identifier is a number (ID) or string (source)
    const isId = /^\d+$/.test(identifier);
    
    if (isId) {
      // Get the specific document chunk by ID
      const { data: chunk, error } = await client
        .from('documents')
        .select('id, content, metadata')
        .eq('id', identifier)
        .single();
      
      if (error) {
        throw error;
      }

      if (!chunk) {
        return NextResponse.json(
          { error: 'Document chunk not found' }, 
          { status: 404 }
        );
      }

      // Transform to match the expected format
      const documentDetail = {
        source: chunk.metadata?.source || 'Unknown Document',
        chunkCount: 1,
        chunks: [{
          id: String(chunk.id),
          chunkIndex: 1,
          content: chunk.content || '',
          metadata: chunk.metadata || {}
        }]
      };

      return NextResponse.json(documentDetail);
    } else {
      // Get all chunks for this specific document source (original behavior)
      const { data: chunks, error } = await client
        .from('documents')
        .select('id, content, metadata')
        .eq('metadata->>source', identifier)
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
          .eq('metadata->>title', identifier)
          .order('id', { ascending: true });
        
        if (titleError) {
          throw titleError;
        }
        allChunks = titleChunks;
      }

      const documentDetail = {
        source: identifier,
        chunkCount: allChunks?.length || 0,
        chunks: allChunks?.map((chunk, index) => ({
          id: String(chunk.id),
          chunkIndex: index + 1,
          content: chunk.content || '',
          metadata: chunk.metadata || {}
        })) || []
      };

      return NextResponse.json(documentDetail);
    }
  } catch (error: any) {
    console.error('Error fetching document chunk(s):', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch document chunks' }, 
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ source: string }> }) {
  return withAdminAuth((req: NextRequest, user: any) => handleGetDocumentChunks(req, user, { params }))(req);
}