import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export const config = {
  matcher: '/api/:path*',
}

export function middleware(request: NextRequest) {
  // Skip API key check for admin routes - they use Bearer tokens instead
  if (request.nextUrl.pathname.startsWith('/api/admin/')) {
    return NextResponse.next()
  }

  // Regular API key check for all other API routes
  const apiKey = request.headers.get('x-api-key')
  const expectedApiKey = process.env.NEXT_PUBLIC_API_KEY

  if (!apiKey || apiKey !== expectedApiKey) {
    return new NextResponse(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'content-type': 'application/json' } }
    )
  }

  return NextResponse.next()
}