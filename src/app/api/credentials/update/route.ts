import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { storePlatformCredentials } from '@/lib/credential-manager';
import { handleError, AuthenticationError, ValidationError } from '@/lib/error-handler';
import { HTTP_STATUS } from '@/lib/constants';

/**
 * Update existing user credentials for a platform
 * PUT /api/credentials/update
 */
export async function PUT(req: NextRequest) {
  try {
    // 1. Authenticate
    const supabase = await supabaseServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new AuthenticationError();
    }

    // 2. Parse request
    const body = await req.json();
    const { agentId, platformSlug, credentials, metadata } = body;

    // 3. Validate
    if (!agentId || !platformSlug || !credentials) {
      throw new ValidationError('Missing required fields: agentId, platformSlug, credentials');
    }

    if (typeof credentials !== 'object') {
      throw new ValidationError('Credentials must be an object');
    }

    // 4. Update credentials (storePlatformCredentials handles upsert)
    await storePlatformCredentials(
      user.id,
      agentId,
      platformSlug,
      credentials,
      'api_key', // Default type, can be enhanced
      metadata
    );

    return NextResponse.json({
      success: true,
      message: 'Credentials updated successfully',
    }, { status: HTTP_STATUS.OK });

  } catch (error) {
    return handleError(error);
  }
}
