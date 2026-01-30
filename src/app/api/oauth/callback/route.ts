/**
 * OAuth Callback Route
 *
 * GET /api/oauth/callback?code=...&state=...
 * Handles OAuth 2.0 authorization callback
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { storeOAuthCredentials } from '@/lib/credential-vault-v2';

// OAuth token exchange configurations
const TOKEN_CONFIGS: Record<string, {
  token_url: string;
  client_id_env: string;
  client_secret_env: string;
  grant_type?: string;
}> = {
  wordpress_oauth: {
    token_url: 'https://public-api.wordpress.com/oauth2/token',
    client_id_env: 'WORDPRESS_CLIENT_ID',
    client_secret_env: 'WORDPRESS_CLIENT_SECRET',
    grant_type: 'authorization_code',
  },
  google_search_console: {
    token_url: 'https://oauth2.googleapis.com/token',
    client_id_env: 'GOOGLE_CLIENT_ID',
    client_secret_env: 'GOOGLE_CLIENT_SECRET',
    grant_type: 'authorization_code',
  },
  google_analytics: {
    token_url: 'https://oauth2.googleapis.com/token',
    client_id_env: 'GOOGLE_CLIENT_ID',
    client_secret_env: 'GOOGLE_CLIENT_SECRET',
    grant_type: 'authorization_code',
  },
};

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // Redirect to error page if OAuth provider returned error
  if (error) {
    const errorDescription = searchParams.get('error_description') || 'Authorization failed';
    console.error('[OAuth] Provider error:', error, errorDescription);
    return NextResponse.redirect(
      new URL(`/dashboard?oauth_error=${encodeURIComponent(errorDescription)}`, req.url)
    );
  }

  // Validate parameters
  if (!code || !state) {
    return NextResponse.redirect(
      new URL('/dashboard?oauth_error=Invalid callback parameters', req.url)
    );
  }

  try {
    // 1. Verify state token (CSRF protection)
    const { data: oauthState, error: stateError } = await supabaseAdmin
      .from('oauth_states')
      .select('*')
      .eq('state_token', state)
      .eq('is_completed', false)
      .single();

    if (stateError || !oauthState) {
      console.error('[OAuth] Invalid state token:', state);
      return NextResponse.redirect(
        new URL('/dashboard?oauth_error=Invalid or expired state', req.url)
      );
    }

    // 2. Check if state is expired (10 minutes)
    const expiresAt = new Date(oauthState.expires_at);
    if (expiresAt < new Date()) {
      console.error('[OAuth] Expired state token:', state);
      return NextResponse.redirect(
        new URL('/dashboard?oauth_error=Authorization expired', req.url)
      );
    }

    // 3. Get token configuration
    const tokenConfig = TOKEN_CONFIGS[oauthState.platform_slug];
    if (!tokenConfig) {
      console.error('[OAuth] Unsupported platform:', oauthState.platform_slug);
      return NextResponse.redirect(
        new URL('/dashboard?oauth_error=Unsupported platform', req.url)
      );
    }

    // 4. Get client credentials from environment
    const clientId = process.env[tokenConfig.client_id_env];
    const clientSecret = process.env[tokenConfig.client_secret_env];

    if (!clientId || !clientSecret) {
      console.error('[OAuth] Missing OAuth credentials');
      return NextResponse.redirect(
        new URL('/dashboard?oauth_error=Configuration error', req.url)
      );
    }

    // 5. Exchange authorization code for tokens
    const tokenResponse = await fetch(tokenConfig.token_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: tokenConfig.grant_type || 'authorization_code',
        code,
        redirect_uri: oauthState.redirect_uri,
        client_id: clientId,
        client_secret: clientSecret,
        ...(oauthState.code_verifier && { code_verifier: oauthState.code_verifier }),
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[OAuth] Token exchange failed:', errorText);
      return NextResponse.redirect(
        new URL('/dashboard?oauth_error=Token exchange failed', req.url)
      );
    }

    const tokens = await tokenResponse.json();

    // 6. Fetch user info from provider (if available)
    let platformUserEmail: string | undefined;
    let platformUserId: string | undefined;

    if (oauthState.platform_slug.startsWith('google_')) {
      try {
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
          },
        });

        if (userInfoResponse.ok) {
          const userInfo = await userInfoResponse.json();
          platformUserEmail = userInfo.email;
          platformUserId = userInfo.id;
        }
      } catch (err) {
        console.warn('[OAuth] Failed to fetch user info:', err);
      }
    }

    // 7. Store credentials in vault
    await storeOAuthCredentials(
      oauthState.user_id,
      oauthState.agent_id,
      oauthState.platform_slug,
      {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in,
        scope: tokens.scope,
        token_type: tokens.token_type,
      },
      {
        platform_user_id: platformUserId,
        platform_user_email: platformUserEmail,
      }
    );

    // 8. Mark OAuth state as completed
    await supabaseAdmin
      .from('oauth_states')
      .update({
        is_completed: true,
        completed_at: new Date().toISOString(),
      })
      .eq('state_token', state);

    console.log('[OAuth] Authorization successful', {
      user_id: oauthState.user_id,
      agent_id: oauthState.agent_id,
      platform: oauthState.platform_slug,
    });

    // 9. Redirect to success page
    return NextResponse.redirect(
      new URL(
        `/dashboard?oauth_success=true&platform=${encodeURIComponent(oauthState.platform_slug)}`,
        req.url
      )
    );
  } catch (error) {
    console.error('[OAuth] Callback error:', error);
    return NextResponse.redirect(
      new URL('/dashboard?oauth_error=An unexpected error occurred', req.url)
    );
  }
}
