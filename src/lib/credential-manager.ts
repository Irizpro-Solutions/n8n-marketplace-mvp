/**
 * Simple Credential Manager
 *
 * Supports:
 * - API keys (OpenAI, Ahrefs, etc.)
 * - Basic auth (WordPress application passwords)
 * - Bearer tokens
 * - Platform-based organization
 * - NO OAuth complexity (for now)
 */

import crypto from 'crypto';
import { supabaseAdmin } from './supabase/admin';

// ============================================================================
// Types
// ============================================================================

export type CredentialType = 'api_key' | 'basic_auth' | 'bearer_token';

export interface PlatformCredentials {
  [key: string]: string;  // e.g., { api_key: "sk-...", site_url: "https://...", username: "..." }
}

export interface CredentialMetadata {
  account_name?: string;
  site_url?: string;
  [key: string]: any;
}

export interface StoredCredential {
  id: string;
  user_id: string;
  agent_id: string;
  platform_slug: string;
  credential_type: CredentialType;
  is_active: boolean;
  metadata?: CredentialMetadata;
  created_at: string;
  updated_at: string;
}

export interface DecryptedCredential {
  platform: string;
  type: CredentialType;
  credentials: PlatformCredentials;  // The actual credential values
  metadata?: CredentialMetadata;
}

// ============================================================================
// Configuration
// ============================================================================

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

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
// Credential Storage
// ============================================================================

/**
 * Store platform credentials (API key, basic auth, etc.)
 */
export async function storePlatformCredentials(
  userId: string,
  agentId: string,
  platformSlug: string,
  credentials: PlatformCredentials,
  type: CredentialType = 'api_key',
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

    // Upsert (insert or update if exists)
    const { error } = await supabaseAdmin
      .from('user_agent_credentials')
      .upsert(credentialData, {
        onConflict: 'user_id,agent_id,platform_slug',
        ignoreDuplicates: false,
      });

    if (error) {
      console.error('[CredentialManager] Store error:', error);
      throw new Error('Failed to store credentials');
    }

    console.log('[CredentialManager] Credentials stored', {
      user_id: userId,
      agent_id: agentId,
      platform: platformSlug,
      type,
    });
  } catch (error) {
    console.error('[CredentialManager] Store failed:', error);
    throw error;
  }
}

// ============================================================================
// Credential Retrieval
// ============================================================================

/**
 * Retrieve credentials for a specific platform
 */
export async function retrievePlatformCredentials(
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
      .maybeSingle();

    if (error) {
      console.error('[CredentialManager] Retrieve error:', error);
      throw new Error('Failed to retrieve credentials');
    }

    if (!data) {
      return null;  // No credentials found
    }

    const record = data as StoredCredential & { encrypted_data: string };

    // Decrypt credentials
    const encryptedData = JSON.parse(record.encrypted_data);
    const decryptedJson = decrypt(encryptedData);
    const credentials = JSON.parse(decryptedJson);

    return {
      platform: platformSlug,
      type: record.credential_type,
      credentials,
      metadata: record.metadata,
    };
  } catch (error) {
    console.error('[CredentialManager] Retrieve failed:', error);
    throw error;
  }
}

/**
 * Retrieve ALL credentials for an agent (all platforms)
 * Returns credentials grouped by platform
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

    if (error) {
      console.error('[CredentialManager] Retrieve all error:', error);
      throw new Error('Failed to retrieve credentials');
    }

    const credentialMap: Record<string, DecryptedCredential> = {};

    for (const record of (data || []) as Array<StoredCredential & { encrypted_data: string }>) {
      try {
        // Decrypt credentials
        const encryptedData = JSON.parse(record.encrypted_data);
        const decryptedJson = decrypt(encryptedData);
        const credentials = JSON.parse(decryptedJson);

        credentialMap[record.platform_slug] = {
          platform: record.platform_slug,
          type: record.credential_type,
          credentials,
          metadata: record.metadata,
        };
      } catch (decryptError) {
        console.error(`[CredentialManager] Failed to decrypt ${record.platform_slug}:`, decryptError);
        // Continue with other credentials
      }
    }

    return credentialMap;
  } catch (error) {
    console.error('[CredentialManager] Retrieve all failed:', error);
    throw error;
  }
}

// ============================================================================
// Credential Management
// ============================================================================

/**
 * Check if user has credentials for a platform
 */
export async function hasPlatformCredentials(
  userId: string,
  agentId: string,
  platformSlug: string
): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin
      .from('user_agent_credentials')
      .select('id')
      .eq('user_id', userId)
      .eq('agent_id', agentId)
      .eq('platform_slug', platformSlug)
      .eq('is_active', true)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return !!data;
  } catch (error) {
    console.error('[CredentialManager] Check failed:', error);
    return false;
  }
}

/**
 * Check if user has ALL required credentials for an agent
 */
export async function hasAllRequiredCredentials(
  userId: string,
  agentId: string
): Promise<{ hasAll: boolean; missing: string[]; required: string[] }> {
  try {
    // Get agent's required platforms
    const { data: agent, error: agentError } = await supabaseAdmin
      .from('agents')
      .select('required_platforms')
      .eq('id', agentId)
      .single();

    if (agentError || !agent) {
      throw new Error('Agent not found');
    }

    const requiredPlatforms = agent.required_platforms || [];

    // If no platforms required, return true
    if (requiredPlatforms.length === 0) {
      return { hasAll: true, missing: [], required: [] };
    }

    // Get user's credentials for this agent
    const { data: credentials, error: credError } = await supabaseAdmin
      .from('user_agent_credentials')
      .select('platform_slug')
      .eq('user_id', userId)
      .eq('agent_id', agentId)
      .eq('is_active', true);

    if (credError) {
      throw credError;
    }

    const userPlatforms = (credentials || []).map((c: any) => c.platform_slug);
    const missing = requiredPlatforms.filter((p: string) => !userPlatforms.includes(p));

    return {
      hasAll: missing.length === 0,
      missing,
      required: requiredPlatforms,
    };
  } catch (error) {
    console.error('[CredentialManager] Check required failed:', error);
    return { hasAll: false, missing: [], required: [] };
  }
}

/**
 * Disconnect credential (soft delete)
 */
export async function disconnectPlatformCredentials(
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

    console.log('[CredentialManager] Credential disconnected', {
      user_id: userId,
      agent_id: agentId,
      platform: platformSlug,
    });
  } catch (error) {
    console.error('[CredentialManager] Disconnect failed:', error);
    throw error;
  }
}

/**
 * Delete credential permanently
 */
export async function deletePlatformCredentials(
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

    console.log('[CredentialManager] Credential deleted', {
      user_id: userId,
      agent_id: agentId,
      platform: platformSlug,
    });
  } catch (error) {
    console.error('[CredentialManager] Delete failed:', error);
    throw error;
  }
}

/**
 * List all credentials for a user-agent pair
 */
export async function listAgentCredentials(
  userId: string,
  agentId: string
): Promise<Array<{
  platform: string;
  type: CredentialType;
  is_active: boolean;
  metadata?: CredentialMetadata;
  created_at: string;
}>> {
  try {
    const { data, error } = await supabaseAdmin
      .from('user_agent_credentials')
      .select('platform_slug, credential_type, is_active, metadata, created_at')
      .eq('user_id', userId)
      .eq('agent_id', agentId);

    if (error) throw error;

    return (data || []).map((record: any) => ({
      platform: record.platform_slug,
      type: record.credential_type,
      is_active: record.is_active,
      metadata: record.metadata,
      created_at: record.created_at,
    }));
  } catch (error) {
    console.error('[CredentialManager] List failed:', error);
    return [];
  }
}

// ============================================================================
// Platform Definitions
// ============================================================================

/**
 * Get platform definition (field schema, instructions, etc.)
 */
export async function getPlatformDefinition(platformSlug: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from('credential_platform_definitions')
      .select('*')
      .eq('platform_slug', platformSlug)
      .eq('is_active', true)
      .single();

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('[CredentialManager] Get platform definition failed:', error);
    return null;
  }
}

/**
 * Get all available platform definitions
 */
export async function getAllPlatformDefinitions() {
  try {
    const { data, error } = await supabaseAdmin
      .from('credential_platform_definitions')
      .select('*')
      .eq('is_active', true)
      .order('platform_name');

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('[CredentialManager] Get all platforms failed:', error);
    return [];
  }
}
