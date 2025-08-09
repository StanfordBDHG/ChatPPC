import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { withAdminAuth } from "@/lib/adminAuth";

async function handleGetLinkClicks(req: NextRequest, _user: any) {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '5');
  const search = searchParams.get('search') || '';
  const offset = (page - 1) * limit;
  
  const client = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PRIVATE_KEY!,
  );

  try {
    // Get most clicked links with their click counts
    const { data: linkClickData, error } = await client
      .from('link_clicks')
      .select('link_url, link_text, clicked_at')
      .order('clicked_at', { ascending: false });

    if (error) throw error;

    // Group by URL and count clicks
    const linkStats = new Map();
    
    linkClickData?.forEach(click => {
      const url = click.link_url;
      const text = click.link_text || 'No text';
      
      if (!linkStats.has(url)) {
        linkStats.set(url, {
          url: url,
          text: text,
          clickCount: 0,
          lastClicked: click.clicked_at
        });
      }
      
      const stat = linkStats.get(url);
      stat.clickCount++;
      
      // Update last clicked if this click is more recent
      if (new Date(click.clicked_at) > new Date(stat.lastClicked)) {
        stat.lastClicked = click.clicked_at;
        stat.text = text; // Update text to most recent
      }
    });

    // Convert to array and sort by click count
    let allSortedLinks = Array.from(linkStats.values())
      .sort((a, b) => b.clickCount - a.clickCount);

    // Apply search filter if provided
    if (search.trim()) {
      allSortedLinks = allSortedLinks.filter(link => 
        link.text.toLowerCase().includes(search.trim().toLowerCase()) ||
        link.url.toLowerCase().includes(search.trim().toLowerCase())
      );
    }

    // Apply pagination
    const paginatedLinks = allSortedLinks.slice(offset, offset + limit);
    const totalLinks = allSortedLinks.length;
    const totalPages = Math.ceil(totalLinks / limit);

    // Get total click count
    const totalClicks = linkClickData?.length || 0;

    return NextResponse.json({
      mostClickedLinks: paginatedLinks,
      totalClicks: totalClicks,
      uniqueLinks: linkStats.size,
      pagination: {
        page,
        limit,
        total: totalLinks,
        pages: totalPages
      }
    });
  } catch (error: any) {
    console.error('Error fetching link click stats:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch link click stats' }, 
      { status: 500 }
    );
  }
}

export const GET = withAdminAuth(handleGetLinkClicks);