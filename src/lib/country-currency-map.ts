/**
 * Country to Currency Mapping
 * Maps ISO 3166-1 alpha-2 country codes to supported currencies
 * Based on Razorpay's supported currencies and regional preferences
 */

export type CurrencyCode = 'INR' | 'USD' | 'AED' | 'EUR' | 'GBP'

/**
 * Comprehensive country-to-currency mapping
 * Prioritizes regional currencies over USD
 */
export const COUNTRY_TO_CURRENCY: Record<string, CurrencyCode> = {
  // India - Primary market
  'IN': 'INR',

  // United States
  'US': 'USD',

  // UAE and Middle East (AED preferred)
  'AE': 'AED', // United Arab Emirates
  'SA': 'AED', // Saudi Arabia (fallback to AED as proxy)
  'QA': 'AED', // Qatar
  'KW': 'AED', // Kuwait
  'OM': 'AED', // Oman
  'BH': 'AED', // Bahrain

  // Eurozone (EUR)
  'AT': 'EUR', // Austria
  'BE': 'EUR', // Belgium
  'CY': 'EUR', // Cyprus
  'EE': 'EUR', // Estonia
  'FI': 'EUR', // Finland
  'FR': 'EUR', // France
  'DE': 'EUR', // Germany
  'GR': 'EUR', // Greece
  'IE': 'EUR', // Ireland
  'IT': 'EUR', // Italy
  'LV': 'EUR', // Latvia
  'LT': 'EUR', // Lithuania
  'LU': 'EUR', // Luxembourg
  'MT': 'EUR', // Malta
  'NL': 'EUR', // Netherlands
  'PT': 'EUR', // Portugal
  'SK': 'EUR', // Slovakia
  'SI': 'EUR', // Slovenia
  'ES': 'EUR', // Spain

  // United Kingdom (GBP)
  'GB': 'GBP', // United Kingdom

  // North America (USD)
  'CA': 'USD', // Canada
  'MX': 'USD', // Mexico

  // South America (USD as proxy)
  'BR': 'USD', // Brazil
  'AR': 'USD', // Argentina
  'CL': 'USD', // Chile
  'CO': 'USD', // Colombia
  'PE': 'USD', // Peru

  // Asia Pacific (USD as proxy, except India)
  'AU': 'USD', // Australia
  'NZ': 'USD', // New Zealand
  'SG': 'USD', // Singapore
  'HK': 'USD', // Hong Kong
  'JP': 'USD', // Japan
  'KR': 'USD', // South Korea
  'MY': 'USD', // Malaysia
  'TH': 'USD', // Thailand
  'PH': 'USD', // Philippines
  'ID': 'USD', // Indonesia
  'VN': 'USD', // Vietnam

  // Africa (USD as proxy)
  'ZA': 'USD', // South Africa
  'NG': 'USD', // Nigeria
  'KE': 'USD', // Kenya
  'EG': 'USD', // Egypt

  // Other regions default to USD in getCurrencyFromCountry function
}

/**
 * Get currency code from country code with fallback
 *
 * Default behavior:
 * - India (IN) → INR
 * - USA (US) → USD
 * - UAE/Middle East (AE, SA, etc.) → AED
 * - European Union → EUR
 * - UK (GB) → GBP
 * - ALL OTHER COUNTRIES → USD (default for rest of world)
 */
export function getCurrencyFromCountry(countryCode: string | null): CurrencyCode {
  // If no country code detected, default to USD (international default)
  if (!countryCode) return 'USD'

  const currency = COUNTRY_TO_CURRENCY[countryCode.toUpperCase()]

  // For unmapped countries, default to USD (not INR)
  // This ensures international users see familiar pricing
  return currency || 'USD'
}

/**
 * Get user-friendly country name (optional - for display purposes)
 */
export function getCountryName(countryCode: string): string {
  const countryNames: Record<string, string> = {
    'IN': 'India',
    'US': 'United States',
    'AE': 'United Arab Emirates',
    'GB': 'United Kingdom',
    'DE': 'Germany',
    'FR': 'France',
    'CA': 'Canada',
    'AU': 'Australia',
    'SG': 'Singapore',
    // Add more as needed
  }

  return countryNames[countryCode] || countryCode
}

/**
 * Validate if currency is supported by Razorpay
 * Note: International currencies require Razorpay International activation
 */
export function isCurrencySupported(currency: string): boolean {
  return ['INR', 'USD', 'AED', 'EUR', 'GBP'].includes(currency)
}
