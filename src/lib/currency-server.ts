/**
 * Server-Side Currency Detection
 * Used for validating user-provided currency against actual location
 * Prevents currency manipulation exploits
 */

import { NextRequest } from 'next/server'

// Country code to currency mapping (same as client-side)
const COUNTRY_CURRENCY_MAP: Record<string, string> = {
  'IN': 'INR', // India
  'US': 'USD', // United States
  'AE': 'AED', // United Arab Emirates
  'SA': 'AED', // Saudi Arabia (use AED as fallback)
  'DE': 'EUR', // Germany
  'FR': 'EUR', // France
  'IT': 'EUR', // Italy
  'ES': 'EUR', // Spain
  'NL': 'EUR', // Netherlands
  'BE': 'EUR', // Belgium
  'AT': 'EUR', // Austria
  'PT': 'EUR', // Portugal
  'IE': 'EUR', // Ireland
  'FI': 'EUR', // Finland
  'GR': 'EUR', // Greece
  'GB': 'USD', // UK (fallback to USD)
  'CA': 'USD', // Canada (fallback)
  'AU': 'USD', // Australia (fallback)
  'SG': 'USD', // Singapore (fallback)
  'HK': 'USD', // Hong Kong (fallback)
}

/**
 * Detect currency from server-side request headers
 * More secure than client-side detection as it's harder to manipulate
 */
export function detectUserCurrencyServer(req: NextRequest): string {
  try {
    // Method 1: Accept-Language header (most reliable for region)
    const acceptLanguage = req.headers.get('accept-language') || ''

    // Parse Accept-Language header (format: "en-US,en;q=0.9,hi;q=0.8")
    const languageTags = acceptLanguage.split(',').map(tag => tag.split(';')[0].trim())

    for (const tag of languageTags) {
      // Check for locale-specific tags (e.g., "en-IN", "ar-AE")
      if (tag.includes('-')) {
        const [, region] = tag.split('-')
        const upperRegion = region.toUpperCase()

        // Direct locale-based currency mapping
        if (tag.includes('en-IN') || tag.includes('hi-IN') || tag.includes('hi')) return 'INR'
        if (tag.includes('ar-AE') || tag.includes('ar-SA')) return 'AED'
        if (tag.includes('de-') || tag.includes('fr-') || tag.includes('es-') || tag.includes('it-')) return 'EUR'

        // Country code based mapping
        if (COUNTRY_CURRENCY_MAP[upperRegion]) {
          console.log(`[Currency Detection] Detected ${COUNTRY_CURRENCY_MAP[upperRegion]} from Accept-Language: ${tag}`)
          return COUNTRY_CURRENCY_MAP[upperRegion]
        }
      }

      // Check for language-only tags
      if (tag.startsWith('hi') || tag.startsWith('mr') || tag.startsWith('ta') || tag.startsWith('te')) return 'INR'
      if (tag.startsWith('ar')) return 'AED'
      if (tag.startsWith('de') || tag.startsWith('fr') || tag.startsWith('es') || tag.startsWith('it')) return 'EUR'
    }

    // Method 2: CloudFlare or Vercel geo headers (if available)
    const cfCountry = req.headers.get('cf-ipcountry') // CloudFlare
    const vercelCountry = req.headers.get('x-vercel-ip-country') // Vercel
    const country = (cfCountry || vercelCountry || '').toUpperCase()

    if (country && COUNTRY_CURRENCY_MAP[country]) {
      console.log(`[Currency Detection] Detected ${COUNTRY_CURRENCY_MAP[country]} from geo header: ${country}`)
      return COUNTRY_CURRENCY_MAP[country]
    }

    // Method 3: IP-based detection (future enhancement)
    // const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip')
    // const currency = await detectCurrencyFromIP(ip)
    // if (currency) return currency

  } catch (error) {
    console.error('[Currency Detection] Server-side detection failed:', error)
  }

  // Fallback to USD for rest of world
  console.log('[Currency Detection] Using fallback currency: USD')
  return 'USD'
}

/**
 * Validate if requested currency matches detected currency
 * Returns validation result with detected currency for override
 */
export function validateCurrency(
  requestedCurrency: string,
  req: NextRequest
): {
  isValid: boolean
  detectedCurrency: string
  shouldOverride: boolean
  reason?: string
} {
  const detectedCurrency = detectUserCurrencyServer(req)

  // If currencies match, validation passes
  if (requestedCurrency === detectedCurrency) {
    return {
      isValid: true,
      detectedCurrency,
      shouldOverride: false
    }
  }

  // Currencies don't match - potential manipulation
  console.warn('[Security] Currency mismatch detected:', {
    requested: requestedCurrency,
    detected: detectedCurrency,
    ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
    userAgent: req.headers.get('user-agent')
  })

  return {
    isValid: false,
    detectedCurrency,
    shouldOverride: true, // Override with detected currency
    reason: `Currency mismatch: requested ${requestedCurrency} but detected ${detectedCurrency}`
  }
}

/**
 * Get safe currency for payment processing
 * Always returns server-detected currency to prevent manipulation
 */
export function getSafeCurrency(
  requestedCurrency: string | undefined,
  req: NextRequest
): string {
  const detectedCurrency = detectUserCurrencyServer(req)

  // If no currency requested, use detected
  if (!requestedCurrency) {
    return detectedCurrency
  }

  // Validate requested currency
  const validation = validateCurrency(requestedCurrency, req)

  // If validation fails, always use detected currency (security)
  if (validation.shouldOverride) {
    console.log(`[Security] Overriding requested currency ${requestedCurrency} with detected ${detectedCurrency}`)
    return detectedCurrency
  }

  return requestedCurrency
}

/**
 * Future enhancement: IP-based geolocation
 * Requires external API (MaxMind, ipapi.co, ip-api.com, etc.)
 */
/*
async function detectCurrencyFromIP(ip: string | null): Promise<string | null> {
  if (!ip) return null

  try {
    // Example using ipapi.co (free tier: 1000 requests/day)
    const response = await fetch(`https://ipapi.co/${ip}/json/`)
    const data = await response.json()
    const countryCode = data.country_code

    return COUNTRY_CURRENCY_MAP[countryCode] || null
  } catch (error) {
    console.error('IP geolocation failed:', error)
    return null
  }
}
*/

export { COUNTRY_CURRENCY_MAP }
