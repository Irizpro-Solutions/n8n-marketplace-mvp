"use client";

import Link from "next/link";
import ModernBackground from "@/components/layouts/ModernBackground";

export default function Home() {
  return (
    <ModernBackground variant="landing">
      {/* Main content */}
      <div className="min-h-screen flex flex-col">
        {/* Minimal header */}
        <header className="absolute top-0 left-0 right-0 z-50">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
              {/* Logo */}
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-violet-600 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <span className="text-xl font-bold text-white">AgentHub</span>
              </div>

              {/* Auth buttons */}
              <div className="flex items-center gap-4">
                <Link
                  href="/auth/login"
                  className="px-6 py-2.5 text-gray-300 hover:text-white transition-colors font-medium"
                >
                  Sign In
                </Link>
                <Link
                  href="/auth/signup"
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-300 font-medium hover:scale-105"
                >
                  Get Started
                </Link>
              </div>
            </div>
          </div>
        </header>

        {/* Hero section */}
        <div className="flex-1 flex items-center justify-center px-6 pt-20">
          <div className="max-w-7xl w-full">
            <div className="text-center space-y-8 mb-16">
              {/* Main heading */}
              <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold leading-tight animate-slide-up">
                <span className="bg-gradient-to-r from-white via-blue-100 to-violet-200 bg-clip-text text-transparent">
                  AI Agents
                </span>
                <br />
                <span className="bg-gradient-to-r from-blue-400 via-violet-400 to-blue-300 bg-clip-text text-transparent">
                  On Demand
                </span>
              </h1>

              {/* Subtitle */}
              <p className="text-xl md:text-2xl text-gray-400 max-w-3xl mx-auto leading-relaxed animate-slide-up animation-delay-200">
                Deploy powerful automation workflows instantly. Pay as you go with credits.
                <span className="text-blue-400"> No subscriptions.</span>
                <span className="text-violet-400"> Just results.</span>
              </p>

              {/* CTA buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up animation-delay-400">
                <Link
                  href="/browse"
                  className="group relative px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white text-lg font-semibold rounded-xl hover:shadow-2xl hover:shadow-blue-500/25 transition-all duration-300 hover:scale-105"
                >
                  <span className="flex items-center gap-2">
                    Explore Agents
                    <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </span>
                </Link>

                <Link
                  href="/browse"
                  className="px-8 py-4 bg-white/5 backdrop-blur-sm border border-white/10 text-white text-lg font-semibold rounded-xl hover:bg-white/10 transition-all duration-300 hover:border-white/20"
                >
                  View Pricing
                </Link>
              </div>
            </div>

            {/* Feature cards */}
            <div className="grid md:grid-cols-3 gap-6 mb-16 animate-slide-up animation-delay-600">
              {/* Card 1 */}
              <div className="group relative bg-white/[0.04] backdrop-blur-sm border border-white/[0.08] rounded-2xl p-8 hover:bg-white/[0.07] transition-all duration-300 hover:scale-105 hover:border-white/[0.15] hover:shadow-xl hover:shadow-blue-500/5">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Instant Deployment</h3>
                <p className="text-gray-400">Launch AI workflows in seconds. No setup, no installation required.</p>
              </div>

              {/* Card 2 */}
              <div className="group relative bg-white/[0.04] backdrop-blur-sm border border-white/[0.08] rounded-2xl p-8 hover:bg-white/[0.07] transition-all duration-300 hover:scale-105 hover:border-white/[0.15] hover:shadow-xl hover:shadow-blue-500/5">
                <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-violet-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Pay Per Use</h3>
                <p className="text-gray-400">Credits start at ₹1. Only pay for what you use. No hidden fees.</p>
              </div>

              {/* Card 3 */}
              <div className="group relative bg-white/[0.04] backdrop-blur-sm border border-white/[0.08] rounded-2xl p-8 hover:bg-white/[0.07] transition-all duration-300 hover:scale-105 hover:border-white/[0.15] hover:shadow-xl hover:shadow-blue-500/5">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-violet-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Enterprise Ready</h3>
                <p className="text-gray-400">Secure, scalable, and reliable. Built for businesses of all sizes.</p>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-8 max-w-3xl mx-auto text-center animate-slide-up animation-delay-800">
              <div className="space-y-2">
                <div className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-400 to-blue-500 bg-clip-text text-transparent">
                  50+
                </div>
                <div className="text-gray-400 text-sm md:text-base">AI Workflows</div>
              </div>
              <div className="space-y-2">
                <div className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-violet-400 to-violet-500 bg-clip-text text-transparent">
                  ₹1
                </div>
                <div className="text-gray-400 text-sm md:text-base">Starting Price</div>
              </div>
              <div className="space-y-2">
                <div className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-400 to-violet-500 bg-clip-text text-transparent">
                  24/7
                </div>
                <div className="text-gray-400 text-sm md:text-base">Always Available</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ModernBackground>
  );
}
