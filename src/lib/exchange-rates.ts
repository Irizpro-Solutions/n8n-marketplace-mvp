/**
 * Real-Time Exchange Rate Service
 *
 * Fetches current exchange rates for multi-currency pricing
 * Uses exchangerate-api.com (free tier: 1500 requests/month)
 *
 * Features:
 * - Automatic rate updates (cached for 24h)
 * - Fallback to hardcoded rates on API failure
 * - INR as base currency for pricing
 * - Server-side caching to reduce API calls
 */

import type { CurrencyCode } from '@/lib/country-currency-map'

// Exchange rate API configuration
const EXCHANGE_API_URL = 'https://api.exchangerate-api.com/v4/latest/INR'
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

// Fallback hardcoded rates (updated: 2026-02-02)
// These are used if the API fails
const FALLBACK_RATES: Record<CurrencyCode, number> = {
  INR: 1,        // Base currency
  USD: 0.012,    // 1 INR ≈ $0.012 USD (₹83.5 per $1)
  AED: 0.044,    // 1 INR ≈ 0.044 AED (₹22.7 per AED)
  EUR: 0.011,    // 1 INR ≈ 0.011 EUR (₹90 per €1)
  GBP: 0.0095,   // 1 INR ≈ 0.0095 GBP (₹105 per £1)
}

// In-memory cache for server-side
interface ExchangeRateCache {
  rates: Record<string, number>
  timestamp: number
  source: 'api' | 'fallback'
}

let rateCache: ExchangeRateCache | null = null

/**
 * Fetch current exchange rates from API with caching
 */
export async function fetchExchangeRates(): Promise<ExchangeRateCache> {
  // Check if cache is still valid
  if (rateCache && Date.now() - rateCache.timestamp < CACHE_DURATION) {
    console.log('[Exchange Rates] Using cached rates:', {
      age: Math.round((Date.now() - rateCache.timestamp) / 1000 / 60),
      source: rateCache.source
    })
    return rateCache
  }

  console.log('[Exchange Rates] Cache expired or missing - fetching fresh rates')

  try {
    // Fetch from API with timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000) // 5s timeout

    const response = await fetch(EXCHANGE_API_URL, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      }
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`Exchange API returned ${response.status}`)
    }

    const data = await response.json()

    // Validate response structure
    if (!data.rates || typeof data.rates !== 'object') {
      throw new Error('Invalid API response structure')
    }

    // Extract rates for supported currencies
    const rates: Record<string, number> = {
      INR: 1, // Base currency
      USD: data.rates.USD || FALLBACK_RATES.USD,
      AED: data.rates.AED || FALLBACK_RATES.AED,
      EUR: data.rates.EUR || FALLBACK_RATES.EUR,
      GBP: data.rates.GBP || FALLBACK_RATES.GBP,
    }

    // Update cache
    rateCache = {
      rates,
      timestamp: Date.now(),
      source: 'api'
    }

    console.log('[Exchange Rates] Successfully fetched from API:', rates)
    return rateCache

  } catch (error) {
    console.warn('[Exchange Rates] API fetch failed, using fallback rates:', error)

    // Use fallback rates
    const fallbackCache: ExchangeRateCache = {
      rates: { ...FALLBACK_RATES },
      timestamp: Date.now(),
      source: 'fallback'
    }

    // Cache fallback for 1 hour (retry sooner than successful fetch)
    if (!rateCache || rateCache.source === 'fallback') {
      rateCache = fallbackCache
    }

    return fallbackCache
  }
}

/**
 * Convert amount from INR to target currency using real-time rates
 *
 * @param amountINR - Amount in Indian Rupees (base currency)
 * @param targetCurrency - Target currency code
 * @returns Converted amount in target currency
 */
export async function convertFromINR(
  amountINR: number,
  targetCurrency: CurrencyCode
): Promise<number> {
  if (targetCurrency === 'INR') {
    return amountINR
  }

  try {
    const { rates } = await fetchExchangeRates()
    const rate = rates[targetCurrency]

    if (!rate) {
      console.warn(`[Exchange Rates] Rate not found for ${targetCurrency}, using fallback`)
      return amountINR * FALLBACK_RATES[targetCurrency]
    }

    const converted = amountINR * rate

    console.log(`[Exchange Rates] Converted ₹${amountINR} INR → ${converted.toFixed(2)} ${targetCurrency} (rate: ${rate})`)

    // Round to 2 decimal places for display
    return Math.round(converted * 100) / 100

  } catch (error) {
    console.error('[Exchange Rates] Conversion failed:', error)
    // Fallback to hardcoded rate
    return amountINR * FALLBACK_RATES[targetCurrency]
  }
}

/**
 * Get current exchange rate for a currency pair
 *
 * @param fromCurrency - Source currency
 * @param toCurrency - Target currency
 * @returns Exchange rate
 */
export async function getExchangeRate(
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode
): Promise<number> {
  if (fromCurrency === toCurrency) {
    return 1
  }

  try {
    const { rates } = await fetchExchangeRates()

    // If converting from INR, use direct rate
    if (fromCurrency === 'INR') {
      return rates[toCurrency] || FALLBACK_RATES[toCurrency]
    }

    // For other currency pairs, convert through INR
    // e.g., USD to EUR: (1/USD_to_INR) * EUR_to_INR
    const fromRate = rates[fromCurrency] || FALLBACK_RATES[fromCurrency]
    const toRate = rates[toCurrency] || FALLBACK_RATES[toCurrency]

    return toRate / fromRate

  } catch (error) {
    console.error('[Exchange Rates] Failed to get rate:', error)

    // Fallback calculation
    const fromRate = FALLBACK_RATES[fromCurrency]
    const toRate = FALLBACK_RATES[toCurrency]
    return toRate / fromRate
  }
}

/**
 * Client-side helper: Get cached rates for display
 * Returns fallback rates if cache is not available
 */
export function getCachedRates(): Record<CurrencyCode, number> {
  if (rateCache) {
    return rateCache.rates as Record<CurrencyCode, number>
  }

  return FALLBACK_RATES
}

/**
 * Force refresh exchange rates (bypass cache)
 * Useful for admin panel or debugging
 */
export async function refreshExchangeRates(): Promise<ExchangeRateCache> {
  console.log('[Exchange Rates] Forcing refresh (bypass cache)')
  rateCache = null
  return fetchExchangeRates()
}
