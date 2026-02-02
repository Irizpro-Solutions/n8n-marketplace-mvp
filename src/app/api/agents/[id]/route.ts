import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { handleError, ResourceNotFoundError } from '@/lib/error-handler'
import { HTTP_STATUS } from '@/lib/constants'
import { rateLimit } from '@/lib/rate-limiter'

// Rate limiter: 100 requests per minute per IP
const rateLimiter = rateLimit({
  maxRequests: 100,
  windowMs: 60000,
})

// Cache configuration
const CACHE_TTL = 60 // 60 seconds

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Apply rate limiting
    const rateLimitResult = await rateLimiter(req)
    if (!rateLimitResult.success) {
      return rateLimitResult.response
    }

    const { id } = await params

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        { error: 'Invalid agent ID format' },
        { status: HTTP_STATUS.BAD_REQUEST }
      )
    }

    // Query single agent using service_role
    const { data: agent, error } = await supabaseAdmin
      .from('agents')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .is('deleted_at', null)
      .single()

    if (error || !agent) {
      throw new ResourceNotFoundError('Agent')
    }

    // Return with cache headers
    return NextResponse.json(
      { success: true, data: agent },
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
