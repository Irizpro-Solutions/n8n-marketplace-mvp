/**
 * OAuth Initiate Route
 *
 * POST /api/oauth/initiate
 * Starts OAuth 2.0 authorization flow for a platform
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import crypto from 'crypto';
import { HTTP_STATUS, ERROR_MESSAGES } from '@/lib/constants';

// OAuth provider configurations
const OAUTH_PROVIDERS: Record<string, {
  auth_url: string;
  scope: string;
  client_id_env: string;
  response_type?: string;
}> = {
  wordpress_oauth: {
    auth_url: 'https://public-api.wordpress.com/oauth2/authorize',
    scope: 'global',
    client_id_env: 'WORDPRESS_CLIENT_ID',
    response_type: 'code',
  },
  google_search_console: {
    auth_url: 'https://accounts.google.com/o/oauth2/v2/auth',
    scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    client_id_env: 'GOOGLE_CLIENT_ID',
    response_type: 'code',
  },
  google_analytics: {
    auth_url: 'https://accounts.google.com/o/oauth2/v2/auth',
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
    client_id_env: 'GOOGLE_CLIENT_ID',
    response_type: 'code',
  },
};

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

    // 2. Parse request
    const body = await req.json();
    const { agentId, platformSlug } = body;

    if (!agentId || !platformSlug) {
      return NextResponse.json(
        { error: 'Agent ID and platform slug are required' },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    // 3. Validate platform
    const providerConfig = OAUTH_PROVIDERS[platformSlug];
    if (!providerConfig) {
      return NextResponse.json(
        { error: `Unsupported OAuth platform: ${platformSlug}` },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    // 4. Get client ID from environment
    const clientId = process.env[providerConfig.client_id_env];
    if (!clientId) {
      console.error(`Missing environment variable: ${providerConfig.client_id_env}`);
      return NextResponse.json(
        { error: 'OAuth configuration error' },
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }

    // 5. Generate CSRF state token
    const stateToken = crypto.randomBytes(32).toString('hex');

    // 6. Generate PKCE code verifier (for enhanced security)
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    // 7. Build redirect URI
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const redirectUri = `${appUrl}/api/oauth/callback`;

    // 8. Store OAuth state in database
    const { error: stateError } = await supabaseAdmin
      .from('oauth_states')
      .insert({
        state_token: stateToken,
        user_id: user.id,
        agent_id: agentId,
        platform_slug: platformSlug,
        code_verifier: codeVerifier,
        redirect_uri: redirectUri,
      });

    if (stateError) {
      console.error('[OAuth] Failed to store state:', stateError);
      return NextResponse.json(
        { error: 'Failed to initiate OAuth flow' },
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }

    // 9. Build authorization URL
    const authUrl = new URL(providerConfig.auth_url);
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', providerConfig.response_type || 'code');
    authUrl.searchParams.set('scope', providerConfig.scope);
    authUrl.searchParams.set('state', stateToken);
    authUrl.searchParams.set('access_type', 'offline');  // Request refresh token
    authUrl.searchParams.set('prompt', 'consent');  // Force consent screen

    // PKCE (for Google and other providers that support it)
    if (platformSlug.startsWith('google_')) {
      authUrl.searchParams.set('code_challenge', codeChallenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');
    }

    console.log('[OAuth] Authorization initiated', {
      user_id: user.id,
      agent_id: agentId,
      platform: platformSlug,
      state_token: stateToken,
    });

    // 10. Return authorization URL
    return NextResponse.json({
      success: true,
      authorization_url: authUrl.toString(),
      state: stateToken,
    });
  } catch (error) {
    console.error('[OAuth] Initiate error:', error);
    return NextResponse.json(
      { error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    );
  }
}
