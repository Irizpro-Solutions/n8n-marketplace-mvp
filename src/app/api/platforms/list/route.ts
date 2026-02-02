import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { handleError } from '@/lib/error-handler'
import { HTTP_STATUS } from '@/lib/constants'
import { rateLimit } from '@/lib/rate-limiter'

// Rate limiter: 60 requests per minute per IP
const rateLimiter = rateLimit({
  maxRequests: 60,
  windowMs: 60000,
})

// Cache configuration
const CACHE_TTL = 3600 // 1 hour (platform definitions rarely change)

export async function GET(req: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResult = await rateLimiter(req)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: 'Too many requests. Please try again later.',
          retryAfter: rateLimitResult.retryAfter,
        },
        {
          status: 429,
          headers: {
            'Retry-After': rateLimitResult.retryAfter?.toString() || '60',
            'X-RateLimit-Limit': rateLimitResult.limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimitResult.reset.toISOString(),
          },
        }
      )
    }

    // Query credential platform definitions using service_role
    const { data: platforms, error } = await supabaseAdmin
      .from('credential_platform_definitions')
      .select('*')
      .eq('is_active', true)
      .order('platform_name', { ascending: true })

    if (error) {
      console.error('[API Error] Failed to fetch platforms:', error)
      return NextResponse.json(
        { error: 'Failed to fetch credential platforms' },
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      )
    }

    // Return with cache headers (long TTL for platform definitions)
    return NextResponse.json(
      { success: true, data: platforms },
      {
        status: HTTP_STATUS.OK,
        headers: {
          'Cache-Control': `public, s-maxage=${CACHE_TTL}, stale-while-revalidate`,
        },
      }
    )
  } catch (error) {
    return handleError(error)
  }
}
