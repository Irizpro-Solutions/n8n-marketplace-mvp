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
const CACHE_TTL = 300 // 5 minutes (pricing rarely changes)

export async function GET(req: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResult = await rateLimiter(req)
    if (!rateLimitResult.success) {
      return rateLimitResult.response
    }

    // Query credit packages using service_role
    const { data: packages, error } = await supabaseAdmin
      .from('credit_packages')
      .select('*')
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('credits', { ascending: true })

    if (error) {
      console.error('[API Error] Failed to fetch credit packages:', error)
      return NextResponse.json(
        { error: 'Failed to fetch credit packages' },
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      )
    }

    // Return with cache headers (longer TTL for pricing)
    return NextResponse.json(
      { success: true, data: packages },
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
