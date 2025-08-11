import { createClient } from '@/lib/supabase'

export async function fetchWithAuth(url: string, options?: RequestInit) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) throw new Error('Not authenticated')

  const headers: HeadersInit = {
    'Authorization': `Bearer ${session.access_token}`
  }

  // Don't set Content-Type for FormData - let browser handle it
  if (options?.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...options?.headers
    }
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`${response.status} - ${errorText}`)
  }
  
  return response.json()
}

export function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}