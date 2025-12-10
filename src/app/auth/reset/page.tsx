'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`
      })

      if (error) {
        setError(error.message)
      } else {
        setMessage('Password reset link sent to your email!')
        setEmail('')
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-green-400 font-mono">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto bg-gray-900 border border-orange-500 rounded-lg p-8">
          <h1 className="text-2xl font-bold mb-6 text-center text-orange-400">
            RESET PASSWORD
          </h1>

          <p className="text-sm text-gray-400 mb-6 text-center">
            Enter your email address and we'll send you a link to reset your password.
          </p>

          {error && (
            <div className="bg-red-900 border border-red-500 text-red-200 p-3 rounded mb-4">
              {error}
            </div>
          )}

          {message && (
            <div className="bg-green-900 border border-green-500 text-green-200 p-3 rounded mb-4">
              {message}
              <div className="text-xs mt-2">
                Check your spam folder if you don't see the email.
              </div>
            </div>
          )}

          <form onSubmit={handleResetRequest} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 bg-black border border-gray-600 rounded focus:border-orange-400 focus:outline-none"
                placeholder="Enter your registered email"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-gray-700 text-white py-2 px-4 rounded transition-colors"
            >
              {loading ? 'Sending Reset Link...' : 'Send Reset Link'}
            </button>
          </form>

          <div className="mt-6 space-y-3 text-center text-sm">
            <p>
              Remember your password?{' '}
              <a href="/auth/login" className="text-cyan-400 hover:underline">
                Back to Login
              </a>
            </p>
            
            <p>
              Don't have an account?{' '}
              <a href="/auth/signup" className="text-purple-400 hover:underline">
                Create account
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}