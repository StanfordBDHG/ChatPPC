import { NextRequest, NextResponse } from "next/server";
import { MarkdownTextSplitter } from "@langchain/textsplitters";
import { createClient } from "@supabase/supabase-js";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { OpenAIEmbeddings } from "@langchain/openai";
import { createHash } from 'crypto';
import { withAdminAuth } from "@/lib/adminAuth";

function getDocumentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

async function getExistingDocumentHash(client: any, source: string): Promise<string | null> {
  try {
    const { data, error } = await client
      .from('documents')
      .select('metadata')
      .eq('metadata->>source', source)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return data.metadata?.hash || null;
  } catch (error) {
    console.error(`Error checking existing document:`, error);
    return null;
  }
}

async function handleUploadDocuments(req: NextRequest, _user: any) {
  try {
    const formData = await req.formData();
    const files = formData.getAll('files') as File[];
    
    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: "No files provided" },
        { status: 400 }
      );
    }

    const client = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PRIVATE_KEY!,
    );

    const splitter = new MarkdownTextSplitter({
      chunkSize: 4000,
      chunkOverlap: 200
    });

    const vectorStore = new SupabaseVectorStore(
      new OpenAIEmbeddings(),
      {
        client,
        tableName: "documents",
        queryName: "match_documents",
      }
    );

    const results = [];

    for (const file of files) {
      try {
        const fileName = file.name;
        const content = await file.text();
        
        if (!content.trim()) {
          results.push({
            fileName,
            status: 'skipped',
            message: 'File is empty'
          });
          continue;
        }

        const currentHash = getDocumentHash(content);
        const existingHash = await getExistingDocumentHash(client, fileName);
        
        if (existingHash === currentHash) {
          results.push({
            fileName,
            status: 'skipped',
            message: 'File content unchanged'
          });
          continue;
        }

        if (existingHash && existingHash !== currentHash) {
          // Delete existing document entries
          const { error } = await client
            .from('documents')
            .delete()
            .eq('metadata->>source', fileName);
          
          if (error) {
            throw new Error(`Failed to delete existing document: ${error.message}`);
          }
        }

        // Split document into chunks
        const splitDocuments = await splitter.createDocuments(
          [content], 
          [{ source: fileName, hash: currentHash }]
        );

        // Store document chunks
        await vectorStore.addDocuments(splitDocuments);
        
        results.push({
          fileName,
          status: 'success',
          message: `Successfully processed ${splitDocuments.length} chunks`,
          chunks: splitDocuments.length
        });

      } catch (fileError: any) {
        results.push({
          fileName: file.name,
          status: 'error',
          message: fileError.message
        });
      }
    }

    return NextResponse.json({ 
      success: true, 
      results,
      totalFiles: files.length,
      successCount: results.filter(r => r.status === 'success').length,
      errorCount: results.filter(r => r.status === 'error').length,
      skippedCount: results.filter(r => r.status === 'skipped').length
    });

  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export const POST = withAdminAuth(handleUploadDocuments);
