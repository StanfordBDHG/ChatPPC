import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { withAdminAuth } from "@/lib/adminAuth";

async function handleGetDocumentsBySource(req: NextRequest, _user: any, { params }: { params: Promise<{ source: string }> }) {
  const client = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PRIVATE_KEY!,
  );
  
  try {
    const { source: rawSource } = await params;
    const sourceIdentifier = decodeURIComponent(rawSource);
    
    // Validate source parameter
    if (!sourceIdentifier || sourceIdentifier.trim().length === 0) {
      return NextResponse.json(
        { error: 'Source parameter cannot be empty' }, 
        { status: 400 }
      );
    }
    
    // Reject if this looks like an ID (should use /documents/[id] endpoint instead)
    if (/^\d+$/.test(sourceIdentifier)) {
      return NextResponse.json(
        { error: 'Use /api/admin/documents/[id] endpoint for ID-based lookups' }, 
        { status: 400 }
      );
    }
    
    // Get all chunks for this specific document source
    const { data: chunks, error } = await client
      .from('documents')
      .select('id, content, metadata')
      .eq('metadata->>source', sourceIdentifier)
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
        .eq('metadata->>title', sourceIdentifier)
        .order('id', { ascending: true });
      
      if (titleError) {
        throw titleError;
      }
      allChunks = titleChunks;
    }

    if (!allChunks || allChunks.length === 0) {
      return NextResponse.json(
        { error: 'No document chunks found for this source' }, 
        { status: 404 }
      );
    }

    const documentDetail = {
      source: sourceIdentifier,
      chunkCount: allChunks.length,
      chunks: allChunks.map((chunk, index) => ({
        id: String(chunk.id),
        chunkIndex: index + 1,
        content: chunk.content || '',
        metadata: chunk.metadata || {}
      }))
    };

    return NextResponse.json(documentDetail);
  } catch (error: any) {
    console.error('Error fetching document chunk(s):', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch document chunks' }, 
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ source: string }> }) {
  return withAdminAuth((req: NextRequest, user: any) => handleGetDocumentsBySource(req, user, { params }))(req);
}