/**
 * Currency Detection API
 * Detects user's currency based on IP geolocation using Vercel headers
 *
 * Returns:
 * - Detected country code
 * - Mapped currency code
 * - Detection method used
 * - Fallback indicator
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrencyFromCountry, getCountryName, isCurrencySupported } from '@/lib/country-currency-map'
import type { CurrencyCode } from '@/lib/country-currency-map'

export const runtime = 'edge' // Use edge runtime for better performance

interface CurrencyDetectionResult {
  country: string | null
  countryName: string | null
  currency: CurrencyCode
  detectionMethod: 'vercel_geo' | 'header_fallback' | 'default'
  isDefaultFallback: boolean
  timestamp: string
}

export async function GET(req: NextRequest) {
  try {
    // Priority 1: Vercel Geo Headers (Production)
    const vercelCountry = req.headers.get('x-vercel-ip-country')

    // Priority 2: Cloudflare headers (if using Cloudflare)
    const cfCountry = req.headers.get('cf-ipcountry')

    // Priority 3: Manual override from query params (for testing)
    const queryCountry = req.nextUrl.searchParams.get('country')

    let detectedCountry: string | null = null
    let detectionMethod: CurrencyDetectionResult['detectionMethod'] = 'default'

    if (queryCountry) {
      // Manual override for testing
      detectedCountry = queryCountry.toUpperCase()
      detectionMethod = 'header_fallback'
      console.log('[Currency Detection] Manual override:', detectedCountry)
    } else if (vercelCountry) {
      // Vercel geo detection (primary method)
      detectedCountry = vercelCountry.toUpperCase()
      detectionMethod = 'vercel_geo'
      console.log('[Currency Detection] Vercel geo:', detectedCountry)
    } else if (cfCountry) {
      // Cloudflare fallback
      detectedCountry = cfCountry.toUpperCase()
      detectionMethod = 'header_fallback'
      console.log('[Currency Detection] Cloudflare geo:', detectedCountry)
    } else {
      // No geo data available (local development)
      console.log('[Currency Detection] No geo headers found - using default')
    }

    // Map country to currency
    const currency = getCurrencyFromCountry(detectedCountry)
    const isDefaultFallback = !detectedCountry || detectedCountry === 'IN'

    // Validate currency is supported
    if (!isCurrencySupported(currency)) {
      console.warn('[Currency Detection] Unsupported currency detected:', currency)
    }

    const result: CurrencyDetectionResult = {
      country: detectedCountry,
      countryName: detectedCountry ? getCountryName(detectedCountry) : null,
      currency,
      detectionMethod,
      isDefaultFallback,
      timestamp: new Date().toISOString()
    }

    // Log for monitoring
    console.log('[Currency Detection] Result:', JSON.stringify(result))

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400', // Cache for 1 hour
      }
    })

  } catch (error) {
    console.error('[Currency Detection] Error:', error)

    // Return safe fallback on error
    return NextResponse.json({
      country: null,
      countryName: null,
      currency: 'INR',
      detectionMethod: 'default',
      isDefaultFallback: true,
      timestamp: new Date().toISOString(),
      error: 'Detection failed - using default currency'
    } as CurrencyDetectionResult, {
      status: 200 // Return 200 even on error to prevent breaking the flow
    })
  }
}

/**
 * Development helper: Test currency detection with specific country
 * Usage: /api/detect-currency?country=US
 */
