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
const CACHE_TTL = 60 // 60 seconds

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

    // Query agents using service_role (bypasses RLS)
    const { data: agents, error } = await supabaseAdmin
      .from('agents')
      .select('*')
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[API Error] Failed to fetch agents:', error)
      return NextResponse.json(
        { error: 'Failed to fetch agents' },
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      )
    }

    // Return with cache headers
    return NextResponse.json(
      { success: true, data: agents },
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
