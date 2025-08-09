import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { withAdminAuth } from "@/lib/adminAuth";

async function handleGetDocuments(_req: NextRequest, _user: any) {
  const client = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PRIVATE_KEY!,
  );
  
  try {
    // Get all document chunks from the vector store
    const { data: chunks, error } = await client
      .from('documents')
      .select('id, content, metadata')
      .limit(1000); // Get more chunks to properly group documents
    
    if (error) {
      throw error;
    }

    // Group chunks by document source (using metadata.source or other identifying field)
    const documentsMap = new Map();
    
    chunks?.forEach(chunk => {
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

    const documents = Array.from(documentsMap.values());

    const documentStats = {
      totalDocuments: documents.length,
      totalChunks: chunks?.length || 0,
      documents: documents
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