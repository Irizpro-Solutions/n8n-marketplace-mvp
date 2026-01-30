// src/types/index.ts - Define all interfaces properly

export interface PricingConfig {
    basePrice: number
    customPrices: { [currency: string]: number } // Remove undefined from type
  }
  
  export interface Agent {
    id: string
    name: string
    description: string
    category: string
    credit_cost: number
    webhook_url?: string
    input_schema?: any[]
    credential_fields?: string[]  // Array of credential field titles (e.g., ["OpenAI API Key", "WordPress URL"])
    is_active: boolean
    created_at: string
    updated_at: string
    pricing_config?: PricingConfig
  }
  
  export interface FormField {
    id: string
    name: string
    type: 'text' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'number' | 'email' | 'url'
    label: string
    placeholder?: string
    required: boolean
    options?: string[]
  }
  
  export interface CurrencyConfig {
    code: string
    symbol: string
    name: string
    razorpaySupported: boolean
    exchangeRate: number
  }