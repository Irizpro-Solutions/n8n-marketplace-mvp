/**
 * Enhanced Credential Vault Service (v2)
 *
 * Supports:
 * - OAuth 2.0 tokens with auto-refresh
 * - API keys
 * - Basic auth
 * - Token expiry tracking
 * - Multi-platform credentials
 */

import crypto from 'crypto';
import { supabaseAdmin } from './supabase/admin';

// ============================================================================
// Types
// ============================================================================

export type CredentialType = 'oauth2' | 'api_key' | 'basic_auth' | 'bearer_token';

export interface OAuthTokens {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;  // Seconds until expiry
  scope?: string;
  token_type?: string;
}

export interface CredentialMetadata {
  platform_user_id?: string;
  platform_user_email?: string;
  account_name?: string;
  profile_picture?: string;
  [key: string]: any;
}

export interface StoredCredential {
  id: string;
  user_id: string;
  agent_id: string;
  platform_slug: string;
  credential_type: CredentialType;

  // Encrypted data
  encrypted_data?: string;  // For API keys, basic auth
  access_token_encrypted?: string;  // For OAuth
  refresh_token_encrypted?: string;  // For OAuth

  // OAuth metadata
  token_expires_at?: string;
  token_scope?: string;

  // Platform info
  platform_user_id?: string;
  platform_user_email?: string;

  // Status
  is_active: boolean;
  last_refreshed_at?: string;

  metadata?: CredentialMetadata;
  created_at: string;
  updated_at: string;
}

export interface DecryptedCredential {
  type: CredentialType;
  platform: string;
  data: Record<string, string>;  // For API keys: { api_key: "..." }
  access_token?: string;  // For OAuth
  refresh_token?: string;  // For OAuth
  expires_at?: Date;
  metadata?: CredentialMetadata;
}

// ============================================================================
// Configuration
// ============================================================================

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const keyHex = process.env.CREDENTIAL_ENCRYPTION_KEY;

  if (!keyHex) {
    throw new Error('CREDENTIAL_ENCRYPTION_KEY environment variable not set');
  }

  if (keyHex.length !== 64) {
    throw new Error('CREDENTIAL_ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
  }

  return Buffer.from(keyHex, 'hex');
}

// ============================================================================
// Encryption Helpers
// ============================================================================

interface EncryptedData {
  encrypted: string;
  iv: string;
  tag: string;
}

function encrypt(plaintext: string): EncryptedData {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const tag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  };
}

function decrypt(encryptedData: EncryptedData): string {
  const key = getEncryptionKey();
  const iv = Buffer.from(encryptedData.iv, 'base64');
  const tag = Buffer.from(encryptedData.tag, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encryptedData.encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

// ============================================================================
// OAuth 2.0 Token Storage
// ============================================================================

/**
 * Store OAuth 2.0 credentials
 */
export async function storeOAuthCredentials(
  userId: string,
  agentId: string,
  platformSlug: string,
  tokens: OAuthTokens,
  metadata?: CredentialMetadata
): Promise<void> {
  try {
    // Encrypt tokens
    const accessTokenEnc = encrypt(tokens.access_token);
    const refreshTokenEnc = tokens.refresh_token ? encrypt(tokens.refresh_token) : null;

    // Calculate expiry
    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : null;

    // Prepare data (store encrypted components separately)
    const credentialData = {
      user_id: userId,
      agent_id: agentId,
      platform_slug: platformSlug,
      credential_type: 'oauth2' as CredentialType,

      // Store access token components
      access_token_encrypted: JSON.stringify(accessTokenEnc),

      // Store refresh token components
      refresh_token_encrypted: refreshTokenEnc ? JSON.stringify(refreshTokenEnc) : null,

      token_expires_at: expiresAt?.toISOString(),
      token_scope: tokens.scope || null,

      platform_user_id: metadata?.platform_user_id,
      platform_user_email: metadata?.platform_user_email,

      is_active: true,
      last_refreshed_at: new Date().toISOString(),

      metadata: metadata || null,
    };

    // Upsert
    const { error } = await supabaseAdmin
      .from('user_agent_credentials')
      .upsert(credentialData, {
        onConflict: 'user_id,agent_id,platform_slug',
      });

    if (error) {
      console.error('[CredentialVault] OAuth store error:', error);
      throw new Error('Failed to store OAuth credentials');
    }

    console.log('[CredentialVault] OAuth credentials stored', {
      user_id: userId,
      agent_id: agentId,
      platform: platformSlug,
      expires_at: expiresAt?.toISOString(),
    });
  } catch (error) {
    console.error('[CredentialVault] OAuth store failed:', error);
    throw error;
  }
}

/**
 * Store API key or basic auth credentials
 */
export async function storeApiKeyCredentials(
  userId: string,
  agentId: string,
  platformSlug: string,
  credentials: Record<string, string>,
  type: 'api_key' | 'basic_auth' = 'api_key',
  metadata?: CredentialMetadata
): Promise<void> {
  try {
    // Encrypt credentials JSON
    const credentialsJson = JSON.stringify(credentials);
    const encrypted = encrypt(credentialsJson);

    const credentialData = {
      user_id: userId,
      agent_id: agentId,
      platform_slug: platformSlug,
      credential_type: type,

      // Store encrypted data as JSON (contains encrypted, iv, tag)
      encrypted_data: JSON.stringify(encrypted),
      encryption_iv: encrypted.iv,
      encryption_tag: encrypted.tag,
      encryption_key_version: 1,

      is_active: true,
      metadata: metadata || null,
    };

    const { error } = await supabaseAdmin
      .from('user_agent_credentials')
      .upsert(credentialData, {
        onConflict: 'user_id,agent_id,platform_slug',
      });

    if (error) {
      console.error('[CredentialVault] API key store error:', error);
      throw new Error('Failed to store API key credentials');
    }

    console.log('[CredentialVault] API key credentials stored', {
      user_id: userId,
      agent_id: agentId,
      platform: platformSlug,
      type,
    });
  } catch (error) {
    console.error('[CredentialVault] API key store failed:', error);
    throw error;
  }
}

// ============================================================================
// Credential Retrieval
// ============================================================================

/**
 * Retrieve and decrypt credentials for a specific platform
 */
export async function retrieveCredentialByPlatform(
  userId: string,
  agentId: string,
  platformSlug: string
): Promise<DecryptedCredential | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('user_agent_credentials')
      .select('*')
      .eq('user_id', userId)
      .eq('agent_id', agentId)
      .eq('platform_slug', platformSlug)
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;  // No credentials found
      }
      throw error;
    }

    if (!data) return null;

    const record = data as StoredCredential;

    // Decrypt based on type
    if (record.credential_type === 'oauth2') {
      // Decrypt OAuth tokens
      const accessTokenEnc = JSON.parse(record.access_token_encrypted || '{}');
      const refreshTokenEnc = record.refresh_token_encrypted
        ? JSON.parse(record.refresh_token_encrypted)
        : null;

      const accessToken = decrypt(accessTokenEnc);
      const refreshToken = refreshTokenEnc ? decrypt(refreshTokenEnc) : undefined;

      return {
        type: 'oauth2',
        platform: platformSlug,
        data: {},
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: record.token_expires_at ? new Date(record.token_expires_at) : undefined,
        metadata: record.metadata,
      };
    } else {
      // Decrypt API key / basic auth
      const encryptedData = JSON.parse(record.encrypted_data || '{}');
      const decryptedJson = decrypt(encryptedData);
      const credentials = JSON.parse(decryptedJson);

      return {
        type: record.credential_type,
        platform: platformSlug,
        data: credentials,
        metadata: record.metadata,
      };
    }
  } catch (error) {
    console.error('[CredentialVault] Retrieve failed:', error);
    throw error;
  }
}

/**
 * Retrieve all credentials for an agent (all platforms)
 */
export async function retrieveAllAgentCredentials(
  userId: string,
  agentId: string
): Promise<Record<string, DecryptedCredential>> {
  try {
    const { data, error } = await supabaseAdmin
      .from('user_agent_credentials')
      .select('*')
      .eq('user_id', userId)
      .eq('agent_id', agentId)
      .eq('is_active', true);

    if (error) throw error;

    const credentials: Record<string, DecryptedCredential> = {};

    for (const record of (data || []) as StoredCredential[]) {
      const platformSlug = record.platform_slug;

      if (record.credential_type === 'oauth2') {
        const accessTokenEnc = JSON.parse(record.access_token_encrypted || '{}');
        const refreshTokenEnc = record.refresh_token_encrypted
          ? JSON.parse(record.refresh_token_encrypted)
          : null;

        const accessToken = decrypt(accessTokenEnc);
        const refreshToken = refreshTokenEnc ? decrypt(refreshTokenEnc) : undefined;

        credentials[platformSlug] = {
          type: 'oauth2',
          platform: platformSlug,
          data: {},
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_at: record.token_expires_at ? new Date(record.token_expires_at) : undefined,
          metadata: record.metadata,
        };
      } else {
        const encryptedData = JSON.parse(record.encrypted_data || '{}');
        const decryptedJson = decrypt(encryptedData);
        const creds = JSON.parse(decryptedJson);

        credentials[platformSlug] = {
          type: record.credential_type,
          platform: platformSlug,
          data: creds,
          metadata: record.metadata,
        };
      }
    }

    return credentials;
  } catch (error) {
    console.error('[CredentialVault] Retrieve all failed:', error);
    throw error;
  }
}

// ============================================================================
// Token Refresh (OAuth 2.0)
// ============================================================================

/**
 * Check if OAuth token needs refresh (expires in < 5 minutes)
 */
export function needsRefresh(credential: DecryptedCredential): boolean {
  if (credential.type !== 'oauth2' || !credential.expires_at) {
    return false;
  }

  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
  return credential.expires_at < fiveMinutesFromNow;
}

/**
 * Refresh OAuth token using refresh token
 */
export async function refreshOAuthToken(
  userId: string,
  agentId: string,
  platformSlug: string,
  platformConfig: {
    token_url: string;
    client_id: string;
    client_secret: string;
  }
): Promise<OAuthTokens> {
  try {
    // Get current credentials
    const credential = await retrieveCredentialByPlatform(userId, agentId, platformSlug);

    if (!credential || credential.type !== 'oauth2' || !credential.refresh_token) {
      throw new Error('No valid refresh token found');
    }

    // Call OAuth provider's token endpoint
    const response = await fetch(platformConfig.token_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: credential.refresh_token,
        client_id: platformConfig.client_id,
        client_secret: platformConfig.client_secret,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token refresh failed: ${response.status} ${errorText}`);
    }

    const tokens: OAuthTokens = await response.json();

    // Store new tokens
    await storeOAuthCredentials(
      userId,
      agentId,
      platformSlug,
      tokens,
      credential.metadata
    );

    console.log('[CredentialVault] Token refreshed successfully', {
      user_id: userId,
      platform: platformSlug,
    });

    return tokens;
  } catch (error) {
    console.error('[CredentialVault] Token refresh failed:', error);
    throw error;
  }
}

// ============================================================================
// Credential Management
// ============================================================================

/**
 * Disconnect/revoke credential
 */
export async function disconnectCredential(
  userId: string,
  agentId: string,
  platformSlug: string
): Promise<void> {
  try {
    const { error } = await supabaseAdmin
      .from('user_agent_credentials')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('agent_id', agentId)
      .eq('platform_slug', platformSlug);

    if (error) throw error;

    console.log('[CredentialVault] Credential disconnected', {
      user_id: userId,
      agent_id: agentId,
      platform: platformSlug,
    });
  } catch (error) {
    console.error('[CredentialVault] Disconnect failed:', error);
    throw error;
  }
}

/**
 * Delete credential permanently
 */
export async function deleteCredential(
  userId: string,
  agentId: string,
  platformSlug: string
): Promise<void> {
  try {
    const { error } = await supabaseAdmin
      .from('user_agent_credentials')
      .delete()
      .eq('user_id', userId)
      .eq('agent_id', agentId)
      .eq('platform_slug', platformSlug);

    if (error) throw error;

    console.log('[CredentialVault] Credential deleted', {
      user_id: userId,
      agent_id: agentId,
      platform: platformSlug,
    });
  } catch (error) {
    console.error('[CredentialVault] Delete failed:', error);
    throw error;
  }
}

/**
 * List all credentials for a user-agent pair
 */
export async function listCredentials(
  userId: string,
  agentId: string
): Promise<Array<{
  platform: string;
  type: CredentialType;
  is_active: boolean;
  expires_at?: string;
  metadata?: CredentialMetadata;
}>> {
  try {
    const { data, error } = await supabaseAdmin
      .from('user_agent_credentials')
      .select('platform_slug, credential_type, is_active, token_expires_at, metadata')
      .eq('user_id', userId)
      .eq('agent_id', agentId);

    if (error) throw error;

    return (data || []).map((record: any) => ({
      platform: record.platform_slug,
      type: record.credential_type,
      is_active: record.is_active,
      expires_at: record.token_expires_at,
      metadata: record.metadata,
    }));
  } catch (error) {
    console.error('[CredentialVault] List failed:', error);
    return [];
  }
}
