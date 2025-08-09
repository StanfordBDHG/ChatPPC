import { createClient } from '@/lib/supabase'

export async function fetchWithAuth(url: string) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) throw new Error('Not authenticated')

  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${session.access_token}` }
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