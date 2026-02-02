/**
 * Save User Credentials API Route (Platform-Based)
 *
 * POST /api/credentials/save
 * Saves encrypted credentials for a user-agent-platform combination
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { storePlatformCredentials, getPlatformDefinition, disconnectPlatformCredentials } from '@/lib/credential-manager';
import { HTTP_STATUS, ERROR_MESSAGES } from '@/lib/constants';

export async function POST(req: NextRequest) {
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

    // 2. Parse and validate request
    const body = await req.json();
    const { agentId, platformSlug, credentials, metadata, disconnect } = body;

    // SECURITY: Log request WITHOUT sensitive credential values
    console.log('[API] Save credentials request:', {
      userId: user.id,
      agentId,
      platformSlug,
      hasCredentials: !!credentials,
      credentialKeys: credentials ? Object.keys(credentials) : [],
      // NEVER log: credentials values, metadata with sensitive data
    });

    if (!agentId || typeof agentId !== 'string') {
      return NextResponse.json(
        { error: 'Agent ID is required' },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    if (!platformSlug || typeof platformSlug !== 'string') {
      return NextResponse.json(
        { error: 'Platform slug is required (e.g., "wordpress", "openai")' },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    // Handle disconnect request
    if (disconnect === true) {
      await disconnectPlatformCredentials(user.id, agentId, platformSlug);
      return NextResponse.json({
        success: true,
        message: `Credentials disconnected for ${platformSlug}`,
        platform: platformSlug,
      });
    }

    if (!credentials || typeof credentials !== 'object') {
      return NextResponse.json(
        { error: 'Credentials must be an object' },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    // 3. Verify agent exists (use admin client to bypass RLS)
    const { data: agent, error: agentError } = await supabaseAdmin
      .from('agents')
      .select('id, name, required_platforms')
      .eq('id', agentId)
      .eq('is_active', true)
      .single();

    if (agentError || !agent) {
      console.error('[API] Agent verification failed:', { agentId, error: agentError?.message });
      return NextResponse.json(
        { error: ERROR_MESSAGES.WORKFLOW.AGENT_NOT_FOUND },
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }

    // 4. Get platform definition (field schema, credential type, etc.)
    const platformDef = await getPlatformDefinition(platformSlug);

    if (!platformDef) {
      return NextResponse.json(
        { error: `Unknown platform: ${platformSlug}` },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    // 5. Validate that all required fields are provided
    const fieldSchema = platformDef.field_schema || [];

    for (const field of fieldSchema) {
      if (field.required) {
        const value = credentials[field.name];
        if (!value || (typeof value === 'string' && value.trim() === '')) {
          return NextResponse.json(
            { error: `Missing required field: ${field.label}` },
            { status: HTTP_STATUS.BAD_REQUEST }
          );
        }
      }
    }

    // 5.5. Clean credentials (platform-specific processing)
    const cleanedCredentials = { ...credentials };

    // WordPress: Remove spaces from application_password
    if (platformSlug === 'wordpress' && cleanedCredentials.application_password) {
      cleanedCredentials.application_password = cleanedCredentials.application_password.replace(/\s+/g, '');
    }

    // 6. Encrypt and store credentials
    await storePlatformCredentials(
      user.id,
      agentId,
      platformSlug,
      cleanedCredentials,
      platformDef.credential_type,
      metadata
    );

    // 7. Return success
    return NextResponse.json({
      success: true,
      message: `${platformDef.platform_name} credentials saved successfully`,
      platform: platformSlug,
    });
  } catch (error) {
    // SECURITY: Log error without exposing credential values
    console.error('[API] Save credentials error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      // NEVER log: full error object may contain credentials
    });
    return NextResponse.json(
      { error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    );
  }
}
