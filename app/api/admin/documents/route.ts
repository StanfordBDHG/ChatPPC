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
    // Get all document chunks to group by source first
    const { data: allChunks, error } = await client
      .from('documents')
      .select('id, content, metadata')
      .limit(5000); // Get chunks to properly group documents
    
    if (error) {
      throw error;
    }

    // Group chunks by document source (using metadata.source or other identifying field)
    const documentsMap = new Map();
    
    allChunks?.forEach(chunk => {
      const source = chunk.metadata?.source || 'Unknown Document';
      const title = chunk.metadata?.title || chunk.metadata?.source || 'Untitled';
      
      if (!documentsMap.has(source)) {
        documentsMap.set(source, {
          source,
          title,
          chunkCount: 0
        });
      }
      
      const doc = documentsMap.get(source);
      doc.chunkCount++;
    });

    const allDocuments = Array.from(documentsMap.values());
    const totalDocuments = allDocuments.length;
    const totalPages = Math.ceil(totalDocuments / limit);
    
    // Apply pagination to the grouped documents
    const paginatedDocuments = allDocuments.slice(offset, offset + limit);

    const documentStats = {
      totalDocuments: totalDocuments,
      totalChunks: allChunks?.length || 0,
      documents: paginatedDocuments,
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