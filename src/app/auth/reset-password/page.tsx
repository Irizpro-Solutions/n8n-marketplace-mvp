'use client'

import { useState, useEffect, Suspense } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter, useSearchParams } from 'next/navigation'

function ResetPasswordContent() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [validating, setValidating] = useState(true)
  const router = useRouter()
  const searchParams = useSearchParams()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    // Check if user has a valid session from reset link
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          setError('Invalid or expired reset link')
        } else if (!session) {
          setError('No active session. Please request a new reset link.')
        }
      } catch (err) {
        setError('Failed to validate reset session')
      } finally {
        setValidating(false)
      }
    }

    checkSession()
  }, [supabase.auth])

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Validation
    if (password.length < 6) {
      setError('Password must be at least 6 characters long')
      setLoading(false)
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      })

      if (error) {
        setError(error.message)
      } else {
        // Password updated successfully
        alert('Password updated successfully! Redirecting to dashboard...')
        router.push('/dashboard')
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (validating) {
    return (
      <div className="min-h-screen bg-black text-green-400 font-mono flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse text-2xl mb-4">◉ VALIDATING RESET LINK ◉</div>
          <div className="text-sm">Verifying authorization...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-green-400 font-mono">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto bg-gray-900 border border-orange-500 rounded-lg p-8">
          <h1 className="text-2xl font-bold mb-6 text-center text-orange-400">
            SET NEW PASSWORD
          </h1>

          <p className="text-sm text-gray-400 mb-6 text-center">
            Enter your new password below.
          </p>

          {error && (
            <div className="bg-red-900 border border-red-500 text-red-200 p-3 rounded mb-4">
              {error}
              {error.includes('Invalid') && (
                <div className="text-xs mt-2">
                  <a href="/auth/reset" className="text-cyan-400 hover:underline">
                    Request a new reset link
                  </a>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handlePasswordReset} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">New Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 bg-black border border-gray-600 rounded focus:border-orange-400 focus:outline-none"
                placeholder="Enter new password (min 6 characters)"
                minLength={6}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 bg-black border border-gray-600 rounded focus:border-orange-400 focus:outline-none"
                placeholder="Confirm new password"
                minLength={6}
                required
              />
            </div>

            {/* Password strength indicator */}
            {password && (
              <div className="text-xs">
                <div className="flex items-center space-x-2">
                  <span className="text-gray-400">Password strength:</span>
                  <span className={`${
                    password.length >= 8 ? 'text-green-400' : 
                    password.length >= 6 ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {password.length >= 8 ? 'Strong' : 
                     password.length >= 6 ? 'Fair' : 'Weak'}
                  </span>
                </div>
                <div className="mt-1">
                  <div className={`text-xs ${password.length >= 6 ? 'text-green-400' : 'text-gray-500'}`}>
                    ✓ At least 6 characters
                  </div>
                  <div className={`text-xs ${password === confirmPassword && password ? 'text-green-400' : 'text-gray-500'}`}>
                    ✓ Passwords match
                  </div>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !password || !confirmPassword}
              className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-gray-700 text-white py-2 px-4 rounded transition-colors"
            >
              {loading ? 'Updating Password...' : 'Update Password'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm">
            <a href="/auth/login" className="text-cyan-400 hover:underline">
              Back to Login
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black text-green-400 font-mono flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse text-2xl mb-4">◉ LOADING ◉</div>
          <div className="text-sm">Initializing reset form...</div>
        </div>
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  )
}