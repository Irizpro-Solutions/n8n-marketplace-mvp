/**
 * Credential Vault Service
 *
 * Handles encryption/decryption and storage of user credentials using AES-256-GCM.
 * Credentials are stored per user-agent pair and isolated via RLS policies.
 */

import crypto from 'crypto';
import { supabaseAdmin } from './supabase/admin';

// ============================================================================
// Types
// ============================================================================

interface EncryptedCredential {
  encrypted_data: string;
  encryption_iv: string;
  encryption_tag: string;
  encryption_key_version: number;
}

interface CredentialRecord {
  id: string;
  user_id: string;
  agent_id: string;
  encrypted_data: string;
  encryption_iv: string;
  encryption_tag: string;
  encryption_key_version: number;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Configuration
// ============================================================================

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const TAG_LENGTH = 16; // 128 bits
const KEY_VERSION = 1;

// Get encryption key from environment
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
// Encryption/Decryption
// ============================================================================

/**
 * Encrypt credentials using AES-256-GCM
 */
export function encryptCredentials(
  credentials: Record<string, string>
): EncryptedCredential {
  try {
    const key = getEncryptionKey();

    // Generate random IV (unique per encryption)
    const iv = crypto.randomBytes(IV_LENGTH);

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    // Encrypt the credentials JSON
    const plaintext = JSON.stringify(credentials);
    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    // Get authentication tag
    const tag = cipher.getAuthTag();

    return {
      encrypted_data: encrypted,
      encryption_iv: iv.toString('base64'),
      encryption_tag: tag.toString('base64'),
      encryption_key_version: KEY_VERSION,
    };
  } catch (error) {
    console.error('[CredentialVault] Encryption failed:', error);
    throw new Error('Failed to encrypt credentials');
  }
}

/**
 * Decrypt credentials using AES-256-GCM
 */
export function decryptCredentials(
  encrypted: EncryptedCredential
): Record<string, string> {
  try {
    const key = getEncryptionKey();

    // Convert base64 strings back to buffers
    const iv = Buffer.from(encrypted.encryption_iv, 'base64');
    const tag = Buffer.from(encrypted.encryption_tag, 'base64');
    const encryptedData = encrypted.encrypted_data;

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    // Decrypt
    let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    // Parse JSON
    return JSON.parse(decrypted);
  } catch (error) {
    console.error('[CredentialVault] Decryption failed');
    throw new Error('Failed to decrypt credentials');
  }
}

// ============================================================================
// Database Operations
// ============================================================================

/**
 * Store encrypted credentials for a user-agent pair
 * Creates new record or updates existing
 */
export async function storeCredentials(
  userId: string,
  agentId: string,
  credentials: Record<string, string>
): Promise<void> {
  try {
    // Encrypt credentials
    const encrypted = encryptCredentials(credentials);

    // Upsert into database (insert or update if exists)
    const { error } = await supabaseAdmin
      .from('user_agent_credentials')
      .upsert({
        user_id: userId,
        agent_id: agentId,
        ...encrypted,
      }, {
        onConflict: 'user_id,agent_id',
      });

    if (error) {
      console.error('[CredentialVault] Database error:', error);
      throw new Error('Failed to store credentials');
    }
  } catch (error) {
    console.error('[CredentialVault] Store failed:', error);
    throw error;
  }
}

/**
 * Retrieve and decrypt credentials for a user-agent pair
 * Returns null if no credentials found
 */
export async function retrieveCredentials(
  userId: string,
  agentId: string
): Promise<Record<string, string> | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('user_agent_credentials')
      .select('*')
      .eq('user_id', userId)
      .eq('agent_id', agentId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found
        return null;
      }
      console.error('[CredentialVault] Database error:', error);
      throw new Error('Failed to retrieve credentials');
    }

    if (!data) {
      return null;
    }

    const record = data as CredentialRecord;

    // Decrypt credentials
    const decrypted = decryptCredentials({
      encrypted_data: record.encrypted_data,
      encryption_iv: record.encryption_iv,
      encryption_tag: record.encryption_tag,
      encryption_key_version: record.encryption_key_version,
    });

    return decrypted;
  } catch (error) {
    console.error('[CredentialVault] Retrieve failed:', error);
    throw error;
  }
}

/**
 * Delete credentials for a user-agent pair
 */
export async function deleteCredentials(
  userId: string,
  agentId: string
): Promise<void> {
  try {
    const { error } = await supabaseAdmin
      .from('user_agent_credentials')
      .delete()
      .eq('user_id', userId)
      .eq('agent_id', agentId);

    if (error) {
      console.error('[CredentialVault] Delete failed:', error);
      throw new Error('Failed to delete credentials');
    }
  } catch (error) {
    console.error('[CredentialVault] Delete failed:', error);
    throw error;
  }
}

/**
 * Check if user has credentials for an agent
 */
export async function hasCredentials(
  userId: string,
  agentId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin
      .from('user_agent_credentials')
      .select('id')
      .eq('user_id', userId)
      .eq('agent_id', agentId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return false;
      }
      throw error;
    }

    return !!data;
  } catch (error) {
    console.error('[CredentialVault] Check failed:', error);
    return false;
  }
}
