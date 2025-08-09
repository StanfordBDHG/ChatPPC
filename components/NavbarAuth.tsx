'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Button } from './ui/button'
import type { User } from '@supabase/supabase-js'

export function NavbarAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const supabase = createClient()
    
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      setLoading(false)
    }

    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) return null

  // Only show auth buttons on admin routes or login page
  const isAdminRoute = pathname?.startsWith('/admin')
  const isLoginPage = pathname === '/login'
  
  if (!isAdminRoute && !isLoginPage) return null

  if (user) {
    return (
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">
          {user.email}
        </span>
        <Button
          variant="outline"
          size="default"
          onClick={handleSignOut}
        >
          Sign out
        </Button>
      </div>
    )
  }

  if (isAdminRoute) {
    return (
      <Button
        variant="outline"
        size="default"
        onClick={() => router.push('/login')}
      >
        Admin Login
      </Button>
    )
  }

  return null
}