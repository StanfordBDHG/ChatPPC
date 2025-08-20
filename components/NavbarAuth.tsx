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

  const handleSignIn = () => {
    router.push('/login')
  }

  const handleDashboard = () => {
    router.push('/admin')
  }

  if (loading) {
    return null
  }

  if (user) {
    return (
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">
          {user.email}
        </span>
        <Button
          variant="outline"
          size="default"
          onClick={handleDashboard}
        >
          Dashboard
        </Button>
        <Button
          variant="outline"
          size="default"
          onClick={handleSignOut}
        >
          Log Out
        </Button>
      </div>
    )
  }

  return (
    <Button
      variant="outline"
      size="default"
      onClick={handleSignIn}
    >
      📄
    </Button>
  )
}