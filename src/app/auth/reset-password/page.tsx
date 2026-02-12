'use client'

import { useState, useEffect, Suspense } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import ModernBackground from '@/components/layouts/ModernBackground'

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
      <ModernBackground>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-white text-lg">Validating reset link...</p>
          </div>
        </div>
      </ModernBackground>
    )
  }

  return (
    <ModernBackground>
      <div className="min-h-screen flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {/* Logo/Header */}
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex items-center gap-2 group mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-violet-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <svg
                  className="w-7 h-7 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <span className="text-2xl font-bold text-white">AgentHub</span>
            </Link>
            <h1 className="text-3xl font-bold text-white mb-2">
              Set New Password
            </h1>
            <p className="text-gray-400">
              Enter your new password below
            </p>
          </div>

          {/* Form Card */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 shadow-2xl shadow-blue-500/5">
            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-red-200 text-sm">{error}</p>
                {error.includes('Invalid') && (
                  <p className="text-xs mt-2">
                    <Link href="/auth/reset" className="text-blue-400 hover:text-blue-300 transition-colors">
                      Request a new reset link
                    </Link>
                  </p>
                )}
              </div>
            )}

            <form onSubmit={handlePasswordReset} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">New Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-transparent transition-all"
                  placeholder="Enter new password (min 6 characters)"
                  minLength={6}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-transparent transition-all"
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
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Updating Password...' : 'Update Password'}
              </button>
            </form>

            <div className="mt-6 text-center text-sm">
              <Link href="/auth/login" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
                Back to Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    </ModernBackground>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <ModernBackground>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-white text-lg">Loading...</p>
          </div>
        </div>
      </ModernBackground>
    }>
      <ResetPasswordContent />
    </Suspense>
  )
}
