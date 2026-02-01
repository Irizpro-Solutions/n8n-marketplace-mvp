# IP-Based Currency Detection Implementation Guide

## Overview

This document provides a complete implementation guide for IP-based automatic currency detection with real-time exchange rate conversion.

## Features

✅ **Automatic Currency Detection**
- Uses Vercel's `x-vercel-ip-country` header (no external API needed)
- Detects user's country from IP address
- Maps country to appropriate currency

✅ **Multi-Currency Support**
- **India (IN)** → INR (Indian Rupee)
- **USA (US)** → USD (US Dollar)
- **UAE/Middle East (AE, SA, etc.)** → AED (Dirham)
- **European Union** → EUR (Euro)
- **UK (GB)** → GBP (British Pound)
- **All Other Countries** → USD (default)

✅ **Smart Pricing System**
1. **Admin Custom Prices** (Priority 1): If admin sets custom price for a currency, use it
2. **Real-Time Conversion** (Priority 2): If no custom price, convert from INR using live exchange rates
3. **Fallback Rates** (Priority 3): If API fails, use hardcoded rates

✅ **Caching & Performance**
- Currency detection cached for 24 hours (localStorage)
- Exchange rates cached for 24 hours (server-side)
- Reduces API calls and improves performance

---

## Architecture

```
User Request
    ↓
Vercel Edge (extracts IP → country code via x-vercel-ip-country header)
    ↓
/api/detect-currency (maps country → currency)
    ↓
useCurrency() Hook (caches in localStorage)
    ↓
Browse/Purchase Pages (display prices in detected currency)
    ↓
Razorpay Payment (processes in detected currency)
```

---

## File Structure

```
src/
├── lib/
│   ├── currency.ts                    # Core pricing logic (UPDATED)
│   ├── country-currency-map.ts        # NEW: Country → Currency mapping
│   └── exchange-rates.ts              # NEW: Real-time exchange rate API
├── hooks/
│   └── useCurrency.ts                 # NEW: React hook for currency detection
├── app/api/
│   └── detect-currency/
│       └── route.ts                   # NEW: Currency detection API endpoint
├── app/browse/
│   └── page.tsx                       # UPDATED: Use useCurrency() hook
└── app/purchase/
    └── page.tsx                       # UPDATED: Use detected currency
```

---

## Implementation Steps

### Step 1: Currency Detection in Browse Page

**File:** `src/app/browse/page.tsx`

```typescript
'use client'

import { useCurrency } from '@/hooks/useCurrency'
import { getPriceAsync } from '@/lib/currency'

export default function BrowseAgents() {
  const { currency, loading: currencyLoading } = useCurrency()
  const [agents, setAgents] = useState<Agent[]>([])
  const [agentPrices, setAgentPrices] = useState<Record<string, number>>({})

  // Load agents with real-time pricing
  useEffect(() => {
    const loadAgentsWithPricing = async () => {
      // 1. Load agents from database
      const { data } = await supabase
        .from('agents')
        .select('*')
        .eq('is_active', true)

      if (data) {
        setAgents(data)

        // 2. Calculate prices using real-time exchange rates
        const prices: Record<string, number> = {}
        for (const agent of data) {
          prices[agent.id] = await getPriceAsync(
            agent.pricing_config,
            currency
          )
        }
        setAgentPrices(prices)
      }
    }

    if (!currencyLoading && currency) {
      loadAgentsWithPricing()
    }
  }, [currency, currencyLoading])

  // Display agent with real-time price
  return (
    <AgentCard
      price={agentPrices[agent.id] || agent.credit_cost}
      currency={currency}
    />
  )
}
```

### Step 2: Pass Currency to Purchase Page

**File:** `src/app/browse/page.tsx` (handlePurchase function)

```typescript
const handlePurchase = async (agent: Agent) => {
  // Get real-time price for this currency
  const price = await getPriceAsync(agent.pricing_config, currency)

  const params = new URLSearchParams({
    agent_id: agent.id,
    agent_name: agent.name,
    credit_cost: price.toString(),      // Real-time converted price
    currency: currency,                  // Detected currency
    new_purchase: 'true'
  })

  router.push(`/purchase?${params.toString()}`)
}
```

### Step 3: Purchase Page Uses Detected Currency

**File:** `src/app/purchase/page.tsx`

Already implemented! The purchase page reads currency from URL params:

```typescript
const currency = searchParams.get('currency') || 'USD'
```

This currency is then passed to:
1. Razorpay order creation (`/api/razorpay/create-order`)
2. Razorpay checkout modal
3. Payment verification (`/api/razorpay/verify-payment`)

---

## Edge Cases & Handling

### 1. VPN Users (Wrong Country Detection)

**Problem:** User in India using US VPN → Sees USD prices
**Solution:** Add manual currency selector (optional)

```typescript
// Optional: Add currency override button
const { currency, setCurrency } = useCurrency()

<select value={currency} onChange={(e) => setCurrency(e.target.value)}>
  <option value="INR">🇮🇳 INR</option>
  <option value="USD">🇺🇸 USD</option>
  <option value="AED">🇦🇪 AED</option>
  <option value="EUR">🇪🇺 EUR</option>
  <option value="GBP">🇬🇧 GBP</option>
</select>
```

### 2. Local Development (No Vercel Headers)

**Problem:** `x-vercel-ip-country` header not available in localhost
**Solution:** API defaults to USD for international users

**Testing:** Use query parameter override:
```
http://localhost:3000/api/detect-currency?country=IN
```

### 3. Exchange Rate API Failure

**Problem:** exchangerate-api.com is down or rate limited
**Solution:** Automatic fallback to hardcoded rates in `exchange-rates.ts`

```typescript
const FALLBACK_RATES = {
  INR: 1,
  USD: 0.012,
  AED: 0.044,
  EUR: 0.011,
  GBP: 0.0095,
}
```

### 4. Razorpay Currency Support

**Important:** Not all currencies are enabled by default in Razorpay.

**Action Required:**
1. Login to Razorpay Dashboard
2. Go to Settings → International Payments
3. Enable required currencies: USD, AED, EUR, GBP
4. Complete KYC for international payments

**Note:** International payments settle in INR at prevailing exchange rates.

---

## Admin Panel: Setting Custom Prices

When creating/editing an agent, admins can set custom prices:

```typescript
// Agent pricing configuration
{
  basePrice: 50,           // ₹50 INR (base price)
  customPrices: {
    'USD': 0.99,          // Custom $0.99 (admin set)
    'AED': 3.99,          // Custom د.إ3.99 (admin set)
    // EUR, GBP → Auto-convert using real-time rates
  }
}
```

**Behavior:**
- If custom price exists → Use custom price (admin-defined)
- If no custom price → Use real-time exchange rate conversion from INR

---

## Testing Checklist

### Local Development Testing

```bash
# Test currency detection API
curl http://localhost:3000/api/detect-currency

# Test with specific country
curl http://localhost:3000/api/detect-currency?country=US
curl http://localhost:3000/api/detect-currency?country=AE
curl http://localhost:3000/api/detect-currency?country=DE
```

### Production Testing (Vercel)

1. **Test from different countries:**
   - Use VPN to connect from US, UAE, Germany
   - Verify correct currency is detected
   - Check prices are converted correctly

2. **Test manual override:**
   - Click currency selector (if implemented)
   - Switch to different currency
   - Verify localStorage is updated

3. **Test payment flow:**
   - Complete purchase from non-INR country
   - Verify Razorpay processes in correct currency
   - Check credits are added correctly

4. **Test caching:**
   - First visit → API call to `/api/detect-currency`
   - Reload page → Should use cached currency (no API call)
   - After 24h → Should refresh currency

---

## Performance Optimization

### 1. Currency Detection Caching

```typescript
// Cached for 24 hours in localStorage
localStorage.setItem('user_currency_v2', 'USD')
localStorage.setItem('user_currency_expiry_v2', timestamp)
```

### 2. Exchange Rate Caching

```typescript
// Server-side cache (24 hours)
let rateCache: ExchangeRateCache | null = null
```

### 3. Vercel Edge Caching

```typescript
// API response cached at edge for 1 hour
return NextResponse.json(result, {
  headers: {
    'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400'
  }
})
```

---

## Monitoring & Logging

### What to Monitor

```typescript
// Currency detection logs
console.log('[Currency Detection] Vercel geo:', detectedCountry)
console.log('[useCurrency] Currency detected:', currency)

// Exchange rate logs
console.log('[Exchange Rates] Successfully fetched from API:', rates)
console.log('[Exchange Rates] Using cached rates:', { age: minutes })

// Pricing logs
console.log('[Pricing] Using custom admin price for USD: $0.99')
console.log('[Pricing] Auto-converted from ₹50 INR to USD: $0.60')
```

### Error Monitoring

```typescript
// Exchange rate API failures
console.warn('[Exchange Rates] API fetch failed, using fallback rates')

// Detection failures
console.error('[Currency Detection] Error:', error)
```

---

## Migration from Current System

### Current State
- Currency is hardcoded in URL params: `?currency=USD`
- No automatic detection
- No real-time exchange rates

### Migration Steps

1. ✅ Deploy new files (country-currency-map.ts, exchange-rates.ts, useCurrency.ts)
2. ✅ Deploy API endpoint (/api/detect-currency)
3. 🔄 Update browse page to use useCurrency() hook
4. 🔄 Update purchase page to use detected currency
5. ✅ Test with VPN from different countries
6. ✅ Enable Razorpay international payments

**Backward Compatibility:** URL params still work! If `?currency=USD` is in URL, it will override auto-detection.

---

## API Reference

### GET /api/detect-currency

**Headers:**
- `x-vercel-ip-country` (provided by Vercel) - ISO 3166-1 alpha-2 country code

**Query Parameters:**
- `country` (optional) - Manual country override for testing

**Response:**
```json
{
  "country": "US",
  "countryName": "United States",
  "currency": "USD",
  "detectionMethod": "vercel_geo",
  "isDefaultFallback": false,
  "timestamp": "2026-02-02T12:00:00.000Z"
}
```

### React Hook: useCurrency()

```typescript
const {
  currency,         // CurrencyCode ('INR' | 'USD' | 'AED' | 'EUR' | 'GBP')
  loading,          // boolean - true while detecting
  error,            // string | null - error message if detection failed
  detectionInfo,    // Object with country, method, timestamp
  setCurrency,      // Function to manually override currency
  refreshCurrency   // Function to force re-detection
} = useCurrency()
```

---

## Troubleshooting

### Currency Not Detected in Production

**Check:**
1. Is app deployed on Vercel? (Required for `x-vercel-ip-country` header)
2. Check browser console for API errors
3. Check localStorage for cached currency
4. Try manual refresh: `refreshCurrency()`

### Exchange Rates Not Updating

**Check:**
1. Server logs for API fetch errors
2. Rate limit on exchangerate-api.com (1500 req/month free tier)
3. Fallback rates are being used (check logs)
4. Force refresh: `refreshExchangeRates()`

### Razorpay Payment Fails with Currency Error

**Check:**
1. Is currency enabled in Razorpay Dashboard?
2. International payments activated?
3. KYC completed for international payments?
4. Currency is in supported list: INR, USD, AED, EUR, GBP

---

## Future Enhancements

### 1. Real-Time Rate Display
Show exchange rate and source to users:
```typescript
const { rates, source } = await fetchExchangeRates()
// Display: "₹50 ≈ $0.60 (Live rate, updated 2h ago)"
```

### 2. Currency Comparison
Let users compare prices across currencies:
```typescript
<PriceComparison agent={agent} currencies={['INR', 'USD', 'EUR']} />
```

### 3. Admin Rate Override
Allow admins to lock exchange rates for stability:
```typescript
{
  basePrice: 50,
  lockedRates: {
    'USD': 0.012  // Lock USD rate instead of using live API
  }
}
```

### 4. Multi-Currency Wallet
Allow users to hold credits in multiple currencies.

---

## Support & Maintenance

### Updating Fallback Rates

Edit `src/lib/exchange-rates.ts`:

```typescript
const FALLBACK_RATES: Record<CurrencyCode, number> = {
  INR: 1,
  USD: 0.012,    // Update these values monthly
  AED: 0.044,
  EUR: 0.011,
  GBP: 0.0095,
}
```

**Recommended:** Update fallback rates monthly from xe.com or similar.

### Adding New Currencies

1. Update `country-currency-map.ts`:
   ```typescript
   export type CurrencyCode = 'INR' | 'USD' | 'AED' | 'EUR' | 'GBP' | 'CAD'  // Add CAD
   ```

2. Update `currency.ts`:
   ```typescript
   SUPPORTED_CURRENCIES: {
     CAD: {
       code: 'CAD',
       symbol: 'C$',
       name: 'Canadian Dollar',
       razorpaySupported: true,
       exchangeRate: 0.016
     }
   }
   ```

3. Enable in Razorpay Dashboard

---

## Questions?

Contact: [Your Support Email]
Documentation: [Link to Wiki/Docs]
