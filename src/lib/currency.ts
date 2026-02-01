// Enhanced src/lib/currency.ts with hardcoded pricing support
// Supports both automatic conversion AND custom pricing per currency

export interface CurrencyConfig {
  code: string
  symbol: string
  name: string
  razorpaySupported: boolean
  exchangeRate: number // Rate to USD base - used for automatic conversion
}

export interface PricingConfig {
  basePrice: number // Price in base currency (INR)
  customPrices?: {
    [currency: string]: number // Custom hardcoded prices
  }
}

export const SUPPORTED_CURRENCIES: Record<string, CurrencyConfig> = {
  INR: {
    code: 'INR',
    symbol: '₹',
    name: 'Indian Rupee',
    razorpaySupported: true,
    exchangeRate: 0.012 // 1 INR = 0.012 USD (approximate)
  },
  USD: {
    code: 'USD',
    symbol: '$',
    name: 'US Dollar',
    razorpaySupported: true,
    exchangeRate: 1 // Base currency for conversion
  },
  AED: {
    code: 'AED',
    symbol: 'د.إ',
    name: 'UAE Dirham',
    razorpaySupported: true,
    exchangeRate: 0.27 // 1 AED = 0.27 USD (approximate)
  },
  EUR: {
    code: 'EUR',
    symbol: '€',
    name: 'Euro',
    razorpaySupported: true,
    exchangeRate: 1.05 // 1 EUR = 1.05 USD (approximate)
  },
  GBP: {
    code: 'GBP',
    symbol: '£',
    name: 'British Pound',
    razorpaySupported: true,
    exchangeRate: 1.27 // 1 GBP = 1.27 USD (approximate)
  }
}


/**
 * Get price with custom pricing support OR real-time conversion
 *
 * Priority Logic:
 * 1. Custom hardcoded price (if admin set it) → Use custom price
 * 2. INR request → Use base price directly
 * 3. Other currencies → Use REAL-TIME exchange rate conversion from INR
 *
 * @param pricingConfig - Agent's pricing configuration
 * @param currency - Target currency code
 * @returns Price in target currency (sync - uses cached rates)
 */
export function getPrice(pricingConfig: PricingConfig, currency: string): number {
  // Priority 1: Check for admin-defined custom price
  if (pricingConfig.customPrices && pricingConfig.customPrices[currency]) {
    console.log(`[Pricing] Using custom admin price for ${currency}: ${pricingConfig.customPrices[currency]}`)
    return pricingConfig.customPrices[currency]
  }

  // Priority 2: Return base price for INR (no conversion needed)
  if (currency === 'INR') {
    console.log(`[Pricing] Using base INR price: ₹${pricingConfig.basePrice}`)
    return pricingConfig.basePrice
  }

  // Priority 3: Auto-convert from INR using HARDCODED rates (for sync usage)
  // Note: For real-time rates, use getPriceAsync() instead
  const convertedPrice = convertCurrency(pricingConfig.basePrice, 'INR', currency)
  console.log(`[Pricing] Auto-converted from ₹${pricingConfig.basePrice} INR to ${currency}: ${convertedPrice} (using hardcoded rates)`)
  return convertedPrice
}

/**
 * ASYNC version: Get price with REAL-TIME exchange rates
 *
 * Use this for accurate pricing when admin hasn't set custom prices.
 * This fetches current exchange rates from API (cached for 24h).
 *
 * @param pricingConfig - Agent's pricing configuration
 * @param currency - Target currency code
 * @returns Promise<Price in target currency>
 */
export async function getPriceAsync(
  pricingConfig: PricingConfig,
  currency: string
): Promise<number> {
  // Import here to avoid circular dependency
  const { convertFromINR } = await import('@/lib/exchange-rates')

  // Priority 1: Check for admin-defined custom price
  if (pricingConfig.customPrices && pricingConfig.customPrices[currency]) {
    console.log(`[Pricing] Using custom admin price for ${currency}: ${pricingConfig.customPrices[currency]}`)
    return pricingConfig.customPrices[currency]
  }

  // Priority 2: Return base price for INR
  if (currency === 'INR') {
    console.log(`[Pricing] Using base INR price: ₹${pricingConfig.basePrice}`)
    return pricingConfig.basePrice
  }

  // Priority 3: Auto-convert using REAL-TIME exchange rates
  const convertedPrice = await convertFromINR(pricingConfig.basePrice, currency as any)
  console.log(`[Pricing] Auto-converted from ₹${pricingConfig.basePrice} INR to ${currency}: ${convertedPrice} (REAL-TIME rate)`)
  return convertedPrice
}

// Check if a price is hardcoded (custom) or auto-converted
export function isPriceHardcoded(pricingConfig: PricingConfig, currency: string): boolean {
  return !!(pricingConfig.customPrices && pricingConfig.customPrices[currency])
}

// Get price with indicators
export function getPriceWithType(pricingConfig: PricingConfig, currency: string): {
  price: number
  isHardcoded: boolean
  source: 'hardcoded' | 'converted'
} {
  const isHardcoded = isPriceHardcoded(pricingConfig, currency)
  const price = getPrice(pricingConfig, currency)
  
  return {
    price,
    isHardcoded,
    source: isHardcoded ? 'hardcoded' : 'converted'
  }
}


export function convertCurrency(
  amount: number, 
  fromCurrency: string, 
  toCurrency: string
): number {
  const fromRate = SUPPORTED_CURRENCIES[fromCurrency]?.exchangeRate || 1
  const toRate = SUPPORTED_CURRENCIES[toCurrency]?.exchangeRate || 1
  
  // Convert to USD first, then to target currency
  const usdAmount = amount * fromRate
  const convertedAmount = usdAmount / toRate
  
  return Math.round(convertedAmount * 100) / 100 // Round to 2 decimal places
}

export function formatCurrency(amount: number, currency: string): string {
  const config = SUPPORTED_CURRENCIES[currency]
  if (!config) return `${amount} ${currency}`
  
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2
    }).format(amount)
  } catch (error) {
    // Fallback formatting
    return `${config.symbol}${amount.toFixed(2)}`
  }
}

export function getCurrencyConfig(currency: string): CurrencyConfig | null {
  return SUPPORTED_CURRENCIES[currency] || null
}

// EXAMPLE: How to define agent pricing with custom prices
export const EXAMPLE_AGENT_PRICING: PricingConfig = {
  basePrice: 50, // ₹50 INR base price
  customPrices: {
    // Custom hardcoded prices (optional)
    'USD': 0.99, // $0.99 USD (premium pricing for US market)
    'AED': 3.99, // د.إ 3.99 AED (rounded to attractive price)
    // 'EUR': Will auto-convert from INR since not specified
  }
}

// Real-time currency conversion (you might want to use a currency API)
export async function fetchExchangeRates(): Promise<Record<string, number>> {
  try {
    // In production, use a real currency API like:
    // - https://api.exchangerate-api.com/v4/latest/USD
    // - https://fixer.io/
    // - https://currencylayer.com/
    
    // For now, return static rates (you should update these regularly)
    return {
      INR: 83.5,  // 1 USD = 83.5 INR
      AED: 3.67,  // 1 USD = 3.67 AED
      EUR: 0.95,  // 1 USD = 0.95 EUR
      USD: 1      // Base currency
    }
  } catch (error) {
    console.error('Failed to fetch exchange rates:', error)
    return {
      INR: 83.5,
      AED: 3.67,
      EUR: 0.95,
      USD: 1
    }
  }
}

