import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { withAdminAuth } from "@/lib/adminAuth";

async function handleGetDocuments(req: NextRequest, _user: any) {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '10');
  const offset = (page - 1) * limit;

  const client = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PRIVATE_KEY!,
  );
  
  try {
    // Get total count for pagination
    const { count: totalCount, error: countError } = await client
      .from('documents')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      throw countError;
    }

    // Get paginated document chunks
    const { data: documentChunks, error } = await client
      .from('documents')
      .select('id, content, metadata')
      .range(offset, offset + limit - 1)
      .order('id', { ascending: true });
    
    if (error) {
      throw error;
    }

    // Transform chunks to match expected format
    const documents = documentChunks?.map(chunk => ({
      id: chunk.id,
      source: chunk.metadata?.source || 'Unknown Document',
      title: chunk.metadata?.title || chunk.metadata?.source || `Chunk ${chunk.id}`,
      content: chunk.content ? chunk.content.substring(0, 100) + '...' : 'No content',
      metadata: chunk.metadata || {},
      chunkCount: 1 // Each row is one chunk
    })) || [];

    const totalDocuments = totalCount || 0;
    const totalPages = Math.ceil(totalDocuments / limit);

    const documentStats = {
      totalDocuments: totalDocuments,
      totalChunks: totalDocuments, // Each document is now a chunk
      documents: documents,
      pagination: {
        page,
        limit,
        total: totalDocuments,
        pages: totalPages
      }
    };

    return NextResponse.json(documentStats);
  } catch (error: any) {
    console.error('Error fetching documents:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch documents' }, 
      { status: 500 }
    );
  }
}

export const GET = withAdminAuth(handleGetDocuments);