'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import Link from 'next/link'
import ModernBackground from '@/components/layouts/ModernBackground'

function AuthErrorContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error') || 'An authentication error occurred'

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
              Authentication Error
            </h1>
          </div>

          {/* Error Card */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 shadow-2xl shadow-blue-500/5">
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-red-200 font-semibold text-sm">Error:</p>
              <p className="text-red-200 text-sm mt-1">{error}</p>
            </div>

            <div className="space-y-3">
              <Link
                href="/auth/signup"
                className="block w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-300 text-center"
              >
                Try Signup Again
              </Link>

              <Link
                href="/auth/login"
                className="block w-full py-3 bg-white/5 border border-white/10 text-white font-semibold rounded-lg hover:bg-white/10 transition-all duration-300 text-center"
              >
                Go to Login
              </Link>

              <Link
                href="/"
                className="block w-full py-3 bg-white/5 border border-white/10 text-gray-300 font-semibold rounded-lg hover:bg-white/10 transition-all duration-300 text-center"
              >
                Back to Home
              </Link>
            </div>

            <div className="mt-6 text-sm text-gray-400">
              <p>Common issues:</p>
              <ul className="list-disc list-inside mt-2 space-y-1 text-gray-500">
                <li>Email verification link expired</li>
                <li>Account already verified</li>
                <li>Invalid verification code</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </ModernBackground>
  )
}

export default function AuthCodeErrorPage() {
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
      <AuthErrorContent />
    </Suspense>
  )
}
