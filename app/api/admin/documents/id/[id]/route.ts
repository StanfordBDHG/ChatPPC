import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { withAdminAuth } from "@/lib/adminAuth";

async function handleGetDocumentById(req: NextRequest, _user: any, { params }: { params: Promise<{ id: string }> }) {
  const client = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PRIVATE_KEY!,
  );
  
  try {
    const { id: rawId } = await params;
    
    // Validate that ID is a positive integer
    if (!/^\d+$/.test(rawId)) {
      return NextResponse.json(
        { error: 'Invalid document ID. Must be a positive integer.' }, 
        { status: 400 }
      );
    }
    
    const documentId = parseInt(rawId);
    
    // Get the specific document chunk by ID
    const { data: chunk, error } = await client
      .from('documents')
      .select('id, content, metadata')
      .eq('id', documentId)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Document chunk not found' }, 
          { status: 404 }
        );
      }
      throw error;
    }

    // Transform to match the expected format
    const documentDetail = {
      id: chunk.id,
      source: chunk.metadata?.source || 'Unknown Document',
      title: chunk.metadata?.title || chunk.metadata?.source || `Chunk ${chunk.id}`,
      content: chunk.content || '',
      metadata: chunk.metadata || {},
      chunkCount: 1,
      chunkIndex: 1
    };

    return NextResponse.json(documentDetail);
  } catch (error: any) {
    console.error('Error fetching document chunk by ID:', error);
    return NextResponse.json(
      { error: 'Failed to fetch document chunk' }, 
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAdminAuth((req: NextRequest, user: any) => handleGetDocumentById(req, user, { params }))(req);
}