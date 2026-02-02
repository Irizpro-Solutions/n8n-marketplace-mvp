import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { handleError, AuthenticationError } from '@/lib/error-handler'
import { HTTP_STATUS } from '@/lib/constants'

// Admin email (hardcoded - should move to environment variable)
const ADMIN_EMAIL = 'team@irizpro.com'

/**
 * GET /api/admin/agents
 * Get all agents (including inactive) for admin panel
 */
export async function GET(req: NextRequest) {
  try {
    // Authenticate user
    const supabase = await supabaseServer()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      throw new AuthenticationError()
    }

    // Check if user is admin
    if (user.email !== ADMIN_EMAIL) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: HTTP_STATUS.FORBIDDEN }
      )
    }

    // Fetch all agents (including inactive) using admin client
    const { data: agents, error } = await supabaseAdmin
      .from('agents')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[Admin API] Failed to fetch agents:', error)
      return NextResponse.json(
        { error: 'Failed to fetch agents' },
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      )
    }

    return NextResponse.json({ success: true, data: agents })
  } catch (error) {
    return handleError(error)
  }
}

/**
 * POST /api/admin/agents
 * Create new agent (admin only)
 */
export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const supabase = await supabaseServer()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      throw new AuthenticationError()
    }

    // Check if user is admin
    if (user.email !== ADMIN_EMAIL) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: HTTP_STATUS.FORBIDDEN }
      )
    }

    // Parse request body
    const body = await req.json()

    // Insert agent using admin client
    const { data: agent, error } = await supabaseAdmin
      .from('agents')
      .insert([body])
      .select()
      .single()

    if (error) {
      console.error('[Admin API] Failed to create agent:', error)
      return NextResponse.json(
        { error: 'Failed to create agent' },
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      )
    }

    return NextResponse.json({ success: true, data: agent })
  } catch (error) {
    return handleError(error)
  }
}

/**
 * PUT /api/admin/agents
 * Update existing agent (admin only)
 */
export async function PUT(req: NextRequest) {
  try {
    // Authenticate user
    const supabase = await supabaseServer()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      throw new AuthenticationError()
    }

    // Check if user is admin
    if (user.email !== ADMIN_EMAIL) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: HTTP_STATUS.FORBIDDEN }
      )
    }

    // Parse request body
    const body = await req.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Agent ID is required' },
        { status: HTTP_STATUS.BAD_REQUEST }
      )
    }

    // Update agent using admin client
    const { data: agent, error } = await supabaseAdmin
      .from('agents')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[Admin API] Failed to update agent:', error)
      return NextResponse.json(
        { error: 'Failed to update agent' },
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      )
    }

    return NextResponse.json({ success: true, data: agent })
  } catch (error) {
    return handleError(error)
  }
}

/**
 * DELETE /api/admin/agents
 * Soft delete agent (admin only)
 */
export async function DELETE(req: NextRequest) {
  try {
    // Authenticate user
    const supabase = await supabaseServer()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      throw new AuthenticationError()
    }

    // Check if user is admin
    if (user.email !== ADMIN_EMAIL) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: HTTP_STATUS.FORBIDDEN }
      )
    }

    // Get agent ID from query params
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Agent ID is required' },
        { status: HTTP_STATUS.BAD_REQUEST }
      )
    }

    // Soft delete agent using admin client
    const { data: agent, error } = await supabaseAdmin
      .from('agents')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[Admin API] Failed to delete agent:', error)
      return NextResponse.json(
        { error: 'Failed to delete agent' },
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      )
    }

    return NextResponse.json({ success: true, data: agent })
  } catch (error) {
    return handleError(error)
  }
}
