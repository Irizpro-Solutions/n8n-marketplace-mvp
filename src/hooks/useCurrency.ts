/**
 * Currency Detection Hook
 * Provides automatic currency detection with caching and manual override
 *
 * Features:
 * - Auto-detects currency on first load
 * - Caches result in localStorage (24h TTL)
 * - Allows manual currency override
 * - Provides loading state
 * - Handles errors gracefully
 *
 * Usage:
 * ```tsx
 * const { currency, loading, setCurrency, detectionInfo } = useCurrency()
 * const price = getPrice(agent.pricing_config, currency)
 * ```
 */

import { useState, useEffect, useCallback } from 'react'
import type { CurrencyCode } from '@/lib/country-currency-map'

const CACHE_KEY = 'user_currency_v2'
const CACHE_EXPIRY_KEY = 'user_currency_expiry_v2'
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours

interface CurrencyDetectionInfo {
  country: string | null
  countryName: string | null
  detectionMethod: 'vercel_geo' | 'header_fallback' | 'default' | 'manual' | 'cached'
  isDefaultFallback: boolean
  timestamp: string
}

interface UseCurrencyReturn {
  currency: CurrencyCode
  loading: boolean
  error: string | null
  detectionInfo: CurrencyDetectionInfo | null
  setCurrency: (currency: CurrencyCode) => void
  refreshCurrency: () => Promise<void>
}

export function useCurrency(): UseCurrencyReturn {
  const [currency, setCurrencyState] = useState<CurrencyCode>('INR')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detectionInfo, setDetectionInfo] = useState<CurrencyDetectionInfo | null>(null)

  /**
   * Fetch currency from API
   */
  const fetchCurrency = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/detect-currency', {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache', // Force fresh detection
        }
      })

      if (!response.ok) {
        throw new Error(`Detection API returned ${response.status}`)
      }

      const data = await response.json()

      // Update state
      setCurrencyState(data.currency)
      setDetectionInfo({
        country: data.country,
        countryName: data.countryName,
        detectionMethod: data.detectionMethod,
        isDefaultFallback: data.isDefaultFallback,
        timestamp: data.timestamp
      })

      // Cache result
      localStorage.setItem(CACHE_KEY, data.currency)
      localStorage.setItem(CACHE_EXPIRY_KEY, (Date.now() + CACHE_TTL).toString())

      console.log('[useCurrency] Currency detected:', data.currency, 'from', data.country)

    } catch (err) {
      console.error('[useCurrency] Detection failed:', err)
      setError(err instanceof Error ? err.message : 'Currency detection failed')

      // Fallback to INR on error
      setCurrencyState('INR')
      setDetectionInfo({
        country: null,
        countryName: null,
        detectionMethod: 'default',
        isDefaultFallback: true,
        timestamp: new Date().toISOString()
      })

    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Initialize currency on mount
   */
  useEffect(() => {
    const initializeCurrency = async () => {
      // Check cache first
      const cachedCurrency = localStorage.getItem(CACHE_KEY)
      const cacheExpiry = localStorage.getItem(CACHE_EXPIRY_KEY)

      if (cachedCurrency && cacheExpiry && Date.now() < parseInt(cacheExpiry, 10)) {
        // Use cached currency
        console.log('[useCurrency] Using cached currency:', cachedCurrency)
        setCurrencyState(cachedCurrency as CurrencyCode)
        setDetectionInfo({
          country: null,
          countryName: null,
          detectionMethod: 'cached',
          isDefaultFallback: false,
          timestamp: new Date().toISOString()
        })
        setLoading(false)
      } else {
        // Fetch fresh currency
        console.log('[useCurrency] Cache miss or expired - fetching currency')
        await fetchCurrency()
      }
    }

    initializeCurrency()
  }, [fetchCurrency])

  /**
   * Manual currency override
   */
  const setCurrency = useCallback((newCurrency: CurrencyCode) => {
    console.log('[useCurrency] Manual override:', newCurrency)
    setCurrencyState(newCurrency)

    // Update cache with manual selection
    localStorage.setItem(CACHE_KEY, newCurrency)
    localStorage.setItem(CACHE_EXPIRY_KEY, (Date.now() + CACHE_TTL).toString())

    // Update detection info to reflect manual selection
    setDetectionInfo({
      country: null,
      countryName: null,
      detectionMethod: 'manual',
      isDefaultFallback: false,
      timestamp: new Date().toISOString()
    })
  }, [])

  /**
   * Refresh currency detection (bypass cache)
   */
  const refreshCurrency = useCallback(async () => {
    console.log('[useCurrency] Manual refresh requested')
    // Clear cache
    localStorage.removeItem(CACHE_KEY)
    localStorage.removeItem(CACHE_EXPIRY_KEY)
    // Fetch fresh
    await fetchCurrency()
  }, [fetchCurrency])

  return {
    currency,
    loading,
    error,
    detectionInfo,
    setCurrency,
    refreshCurrency
  }
}

/**
 * Helper: Get currency from localStorage without hook
 * Useful for initial SSR or API calls before React hydration
 */
export function getCachedCurrency(): CurrencyCode | null {
  if (typeof window === 'undefined') return null

  const cachedCurrency = localStorage.getItem(CACHE_KEY)
  const cacheExpiry = localStorage.getItem(CACHE_EXPIRY_KEY)

  if (cachedCurrency && cacheExpiry && Date.now() < parseInt(cacheExpiry, 10)) {
    return cachedCurrency as CurrencyCode
  }

  return null
}
