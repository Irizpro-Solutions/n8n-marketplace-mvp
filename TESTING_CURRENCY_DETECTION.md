# Testing Currency Detection for Different Countries

## Method 1: Chrome DevTools - Sensor Override (Recommended)

**Steps:**

1. **Open Chrome DevTools**
   - Press `F12` or `Ctrl+Shift+I`
   - Go to **Console** tab

2. **Override Timezone & Locale**
   ```javascript
   // Test India (INR)
   // Change browser timezone in DevTools:
   // 1. Open DevTools → 3 dots menu → More tools → Sensors
   // 2. Set Location to "Other" and Timezone to "Asia/Kolkata"
   // 3. Reload page

   // Or manually test detection:
   Intl.DateTimeFormat().resolvedOptions().timeZone
   // Should show: "Asia/Kolkata" → INR

   navigator.language
   // Should show: "en-IN" → INR
   ```

3. **Test Different Locations**

   **For India (INR):**
   - Timezone: `Asia/Kolkata` or `Asia/Delhi`
   - Locale: `en-IN` or `hi-IN`
   - Expected: Currency = INR, Symbol = ₹

   **For USA (USD):**
   - Timezone: `America/New_York` or `America/Los_Angeles`
   - Locale: `en-US`
   - Expected: Currency = USD, Symbol = $

   **For UAE (AED):**
   - Timezone: `Asia/Dubai`
   - Locale: `ar-AE`
   - Expected: Currency = AED, Symbol = د.إ

   **For Europe (EUR):**
   - Timezone: `Europe/Paris` or `Europe/Berlin`
   - Locale: `fr-FR` or `de-DE`
   - Expected: Currency = EUR, Symbol = €

---

## Method 2: Browser Language Settings

**Chrome:**
1. Go to `chrome://settings/languages`
2. Click "Add languages"
3. Add language for target region:
   - India: Hindi (India) or English (India)
   - UAE: Arabic (United Arab Emirates)
   - France: French (France)
   - Germany: German (Germany)
4. Move to top of preferred languages list
5. Reload `/browse` page
6. Check currency display

**Edge:**
1. Go to `edge://settings/languages`
2. Follow same steps as Chrome

**Firefox:**
1. Go to `about:preferences#general`
2. Scroll to "Language"
3. Add target language
4. Reload page

---

## Method 3: Manual Console Testing

Open browser console (`F12` → Console) and run:

```javascript
// Test currency detection logic directly
function testCurrencyDetection() {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const locale = navigator.language || navigator.languages?.[0]

  console.log('🌍 Current Detection:')
  console.log('Timezone:', timezone)
  console.log('Locale:', locale)

  // Detection logic (same as in code)
  let detectedCurrency = 'USD' // Default

  // Timezone-based
  if (timezone.includes('Kolkata') || timezone.includes('Delhi')) {
    detectedCurrency = 'INR'
  } else if (timezone.includes('Dubai')) {
    detectedCurrency = 'AED'
  } else if (timezone.includes('Europe/')) {
    detectedCurrency = 'EUR'
  } else if (timezone.includes('America/')) {
    detectedCurrency = 'USD'
  }

  // Locale-based override
  if (locale.includes('en-IN') || locale.includes('hi')) {
    detectedCurrency = 'INR'
  } else if (locale.includes('ar-AE')) {
    detectedCurrency = 'AED'
  } else if (locale.includes('de') || locale.includes('fr')) {
    detectedCurrency = 'EUR'
  }

  console.log('💱 Detected Currency:', detectedCurrency)

  return detectedCurrency
}

testCurrencyDetection()
```

---

## Method 4: Using VPN (Real-World Testing)

**Free VPNs for Testing:**
- ProtonVPN (Free tier available)
- Windscribe (10GB/month free)
- Hide.me (10GB/month free)

**Steps:**
1. Install VPN with servers in target countries
2. Connect to server (e.g., India, USA, UAE, Germany)
3. Open browser in **incognito/private mode** (fresh session)
4. Visit your site: `http://localhost:3000/browse`
5. Check currency display

**Why Incognito:** Clears all localStorage and cookies for clean test

---

## Method 5: Quick Test Script (Development)

Create a test page to simulate different locales:

```typescript
// src/app/test-currency/page.tsx
'use client'

import { useState } from 'react'
import { detectUserCurrency, SUPPORTED_CURRENCIES, formatCurrency } from '@/lib/currency'

export default function TestCurrency() {
  const [detectedCurrency, setDetectedCurrency] = useState(detectUserCurrency())

  const testLocations = [
    { name: 'India', timezone: 'Asia/Kolkata', locale: 'en-IN', expected: 'INR' },
    { name: 'USA', timezone: 'America/New_York', locale: 'en-US', expected: 'USD' },
    { name: 'UAE', timezone: 'Asia/Dubai', locale: 'ar-AE', expected: 'AED' },
    { name: 'Germany', timezone: 'Europe/Berlin', locale: 'de-DE', expected: 'EUR' },
  ]

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Currency Detection Test</h1>

      <div className="bg-gray-100 p-6 rounded-lg mb-6">
        <h2 className="text-xl font-semibold mb-4">Current Detection:</h2>
        <p>Timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}</p>
        <p>Locale: {navigator.language}</p>
        <p className="text-2xl font-bold mt-4">
          Detected: {detectedCurrency} {SUPPORTED_CURRENCIES[detectedCurrency]?.symbol}
        </p>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Test Scenarios:</h2>
        {testLocations.map(location => (
          <div key={location.name} className="border p-4 rounded">
            <h3 className="font-bold">{location.name}</h3>
            <p className="text-sm text-gray-600">
              Timezone: {location.timezone}, Locale: {location.locale}
            </p>
            <p className="text-lg">
              Expected: {location.expected} {SUPPORTED_CURRENCIES[location.expected]?.symbol}
            </p>
            <p className="text-sm">
              Sample Price: {formatCurrency(0.99, location.expected)}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
```

Access at: `http://localhost:3000/test-currency`

---

## Method 6: Server-Side Testing (for Phase 2)

Test the server-side detection by sending custom headers:

```bash
# Using curl to test server detection
curl -X POST http://localhost:3000/api/razorpay/create-order \
  -H "Content-Type: application/json" \
  -H "Accept-Language: hi-IN,hi;q=0.9,en;q=0.8" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "packageId": "agent_123",
    "amount": 50,
    "credits": 10,
    "currency": "INR"
  }'

# Expected: Server detects INR from Accept-Language header
```

**Test Different Headers:**

```bash
# India
-H "Accept-Language: hi-IN,hi;q=0.9,en;q=0.8"

# USA
-H "Accept-Language: en-US,en;q=0.9"

# UAE
-H "Accept-Language: ar-AE,ar;q=0.9"

# Germany
-H "Accept-Language: de-DE,de;q=0.9"
```

---

## Method 7: Automated Testing (Advanced)

Create a test suite:

```typescript
// __tests__/currency-detection.test.ts
import { detectUserCurrency } from '@/lib/currency'

describe('Currency Detection', () => {
  beforeEach(() => {
    // Mock browser APIs
    global.navigator = {
      language: 'en-US',
      languages: ['en-US', 'en']
    } as any

    global.Intl = {
      DateTimeFormat: () => ({
        resolvedOptions: () => ({ timeZone: 'America/New_York' })
      })
    } as any
  })

  test('detects USD for US timezone', () => {
    expect(detectUserCurrency()).toBe('USD')
  })

  test('detects INR for India timezone', () => {
    global.Intl = {
      DateTimeFormat: () => ({
        resolvedOptions: () => ({ timeZone: 'Asia/Kolkata' })
      })
    } as any
    expect(detectUserCurrency()).toBe('INR')
  })

  test('detects AED for UAE timezone', () => {
    global.Intl = {
      DateTimeFormat: () => ({
        resolvedOptions: () => ({ timeZone: 'Asia/Dubai' })
      })
    } as any
    expect(detectUserCurrency()).toBe('AED')
  })

  test('detects EUR for Europe timezone', () => {
    global.Intl = {
      DateTimeFormat: () => ({
        resolvedOptions: () => ({ timeZone: 'Europe/Paris' })
      })
    } as any
    expect(detectUserCurrency()).toBe('EUR')
  })
})
```

---

## Real-World Testing Checklist

### Before Deploying to Production:

**1. Local Testing (All Methods Above)**
- [ ] Test India detection (INR)
- [ ] Test USA detection (USD)
- [ ] Test UAE detection (AED)
- [ ] Test Europe detection (EUR)
- [ ] Test fallback (USD for unsupported regions)

**2. Staging/Preview Deployment**
- [ ] Deploy to Vercel preview
- [ ] Test with VPN from different countries
- [ ] Verify Vercel geo headers work (`x-vercel-ip-country`)
- [ ] Check server logs for detection accuracy

**3. Production Monitoring (First Week)**
- [ ] Monitor currency distribution in audit logs
- [ ] Check for unexpected currency mismatches
- [ ] Review user support tickets about currency
- [ ] Analyze conversion rates by currency

---

## Quick Verification Commands

**In Browser Console:**

```javascript
// Check current detection
console.log('Currency:', localStorage.getItem('detected_currency'))
console.log('Timezone:', Intl.DateTimeFormat().resolvedOptions().timeZone)
console.log('Locale:', navigator.language)

// Force re-detection
localStorage.clear()
location.reload()
```

**Check Server Logs:**

```bash
# Look for currency detection logs
grep "Currency Detection" logs/app.log

# Look for security warnings
grep "[SECURITY]" logs/app.log
```

---

## Expected Results by Country

| Country | Timezone | Locale | Expected Currency | Symbol |
|---------|----------|--------|------------------|--------|
| India | Asia/Kolkata | en-IN | INR | ₹ |
| USA | America/New_York | en-US | USD | $ |
| UAE | Asia/Dubai | ar-AE | AED | د.إ |
| Germany | Europe/Berlin | de-DE | EUR | € |
| France | Europe/Paris | fr-FR | EUR | € |
| UK | Europe/London | en-GB | USD* | $ |
| Canada | America/Toronto | en-CA | USD* | $ |
| Singapore | Asia/Singapore | en-SG | USD* | $ |

*Fallback to USD for unsupported currencies

---

## Troubleshooting

### Currency Not Changing When Testing

**Problem:** Currency stays the same despite changing browser settings

**Solution:**
1. Clear browser cache: `Ctrl+Shift+Delete`
2. Clear localStorage: `localStorage.clear()` in console
3. Use incognito mode for each test
4. Hard reload: `Ctrl+Shift+R`

### Wrong Currency Detected

**Problem:** Timezone says "Asia/Kolkata" but shows USD

**Solution:**
1. Check console logs for detection process
2. Verify locale also matches (not just timezone)
3. Ensure browser language is also set correctly
4. Test in clean browser profile

### Server Detection Not Working

**Problem:** Client shows correct currency but server overrides

**Solution:**
1. Check Accept-Language header in network tab
2. Verify request headers include locale information
3. Check server logs for detection results
4. Test with curl to isolate client vs server issues

---

## Summary

**Recommended Testing Order:**

1. ✅ **Method 2** - Change browser language (quickest)
2. ✅ **Method 3** - Console testing (verify logic)
3. ✅ **Method 4** - VPN testing (real-world)
4. ✅ **Method 5** - Test page (visual verification)
5. ✅ **Method 6** - Server testing (security validation)

**Minimum Tests Before Deploy:**
- India → INR ✓
- USA → USD ✓
- UAE → AED ✓
- Europe → EUR ✓
- Unknown → USD ✓

**Testing Time:** ~15-20 minutes for all countries

---

*Test thoroughly before deploying to production to ensure accurate currency detection worldwide!*
