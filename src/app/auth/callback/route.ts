import { supabaseServer } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'
  const type = searchParams.get('type') // email verification, password reset, etc.

  console.log('Callback route hit:', { code: !!code, type, next }) // Debug log

  if (code) {
    try {
      const supabase = await supabaseServer()
      
      // Exchange the code for a session
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)
      
      console.log('Exchange code result:', { data: !!data, error }) // Debug log
      
      if (!error && data.user) {
        console.log('User verified successfully:', data.user.id)
        
        // Handle different callback types
        if (type === 'recovery') {
          // Password reset flow
          console.log('Password reset callback - redirecting to reset form')
          return NextResponse.redirect(`${origin}/auth/reset-password`)
        } else {
          // Regular email verification or login
          console.log('Regular verification - redirecting to:', next)
          return NextResponse.redirect(`${origin}${next}`)
        }
      } else {
        console.error('Email verification failed:', error)
        const redirectUrl = new URL('/auth/auth-code-error', origin)
        redirectUrl.searchParams.set('error', error?.message || 'Verification failed')
        return NextResponse.redirect(redirectUrl.toString())
      }
    } catch (err) {
      console.error('Callback error:', err)
      const redirectUrl = new URL('/auth/auth-code-error', origin)
      redirectUrl.searchParams.set('error', 'Unexpected error during verification')
      return NextResponse.redirect(redirectUrl.toString())
    }
  }

  // No code provided
  console.error('No verification code provided')
  const redirectUrl = new URL('/auth/auth-code-error', origin)
  redirectUrl.searchParams.set('error', 'No verification code provided')
  return NextResponse.redirect(redirectUrl.toString())
}