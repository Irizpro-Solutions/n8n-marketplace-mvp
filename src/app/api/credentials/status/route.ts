/**
 * Get Credentials Status API Route
 *
 * GET /api/credentials/status?agentId=xxx
 * Returns whether user has saved all required credentials for an agent
 * Uses platform-based credential system
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { hasAllRequiredCredentials, listAgentCredentials } from '@/lib/credential-manager';
import { HTTP_STATUS, ERROR_MESSAGES } from '@/lib/constants';

export async function GET(req: NextRequest) {
  try {
    // 1. Authenticate user
    const supabase = await supabaseServer();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.AUTH.UNAUTHORIZED },
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }

    // 2. Get agent ID from query params
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get('agentId');

    if (!agentId) {
      return NextResponse.json(
        { error: 'Agent ID is required' },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    // 3. Check if user has all required credentials for this agent (platform-based)
    let hasAll = true;
    let missing: string[] = [];
    let required: string[] = [];
    let credentials: any[] = [];

    try {
      const credCheck = await hasAllRequiredCredentials(user.id, agentId);
      hasAll = credCheck.hasAll;
      missing = credCheck.missing;
      required = credCheck.required;

      // 4. Get list of user's credentials for this agent
      credentials = await listAgentCredentials(user.id, agentId);
    } catch (credError) {
      console.error('[API] Credential check error:', credError);
      // Return empty/default values instead of failing completely
      hasAll = false;
      missing = [];
      required = [];
      credentials = [];
    }

    // 5. Return detailed status
    return NextResponse.json({
      success: true,
      has_all_credentials: hasAll,
      missing_platforms: missing,
      required_platforms: required,
      credentials, // Add credential list for sidebar
    });
  } catch (error) {
    console.error('[API] Get credentials status error:', error);
    const errorMessage = error instanceof Error ? error.message : ERROR_MESSAGES.GENERIC.INTERNAL_ERROR;
    console.error('[API] Error details:', errorMessage);
    return NextResponse.json(
      { error: errorMessage },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    );
  }
}
