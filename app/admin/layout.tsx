'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      
      // Check if this is a temporary session that should expire on browser close
      const isTempSession = sessionStorage.getItem('temp_session')
      const hasRememberFlag = localStorage.getItem('remember_admin')
      
      if (user && isTempSession && !hasRememberFlag) {
        // For temporary sessions, check if we should maintain the session
        // In a real app, you might want to check session creation time here
      }
      
      setUser(user)
      setLoading(false)
      
      if (!user) {
        // Clear any session flags when user is not authenticated
        sessionStorage.removeItem('temp_session')
        localStorage.removeItem('remember_admin')
        router.push('/login')
      }
    }

    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
          // Clear session flags on sign out
          sessionStorage.removeItem('temp_session')
          localStorage.removeItem('remember_admin')
          router.push('/login')
        } else {
          setUser(session.user)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container py-6 px-6 mx-auto">
        {children}
      </main>
    </div>
  )
}