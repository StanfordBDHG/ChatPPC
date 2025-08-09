import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

export async function createServerSupabaseClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
          }
        },
      },
    }
  )
}

export async function getUser(request?: NextRequest) {
  // For edge runtime, we need to get auth from the Authorization header
  if (request) {
    const authHeader = request.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      
      const supabase = await createServerSupabaseClient()
      try {
        const { data: { user }, error } = await supabase.auth.getUser(token)
        if (error || !user) {
          return null
        }
        return user
      } catch (error) {
        return null
      }
    }
  }
  
  // Fallback to cookie-based auth
  const supabase = await createServerSupabaseClient()
  try {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) {
      return null
    }
    return user
  } catch (error) {
    return null
  }
}

export async function requireAuth(request?: NextRequest) {
  const user = await getUser(request)
  if (!user) {
    throw new Error('Unauthorized')
  }
  return user
}