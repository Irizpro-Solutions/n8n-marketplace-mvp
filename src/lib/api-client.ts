/**
 * API Client for Enterprise Security
 *
 * All public data (agents, packages, platforms) must be fetched
 * via API routes instead of direct Supabase queries.
 *
 * This ensures proper security, rate limiting, and caching.
 */

import { Agent } from '@/types'

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

/**
 * Fetch all active agents from API route
 */
export async function fetchAgents(): Promise<Agent[]> {
  try {
    const response = await fetch('/api/agents/list', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Enable Next.js caching
      next: { revalidate: 60 }, // Revalidate every 60 seconds
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch agents: ${response.statusText}`)
    }

    const result: ApiResponse<Agent[]> = await response.json()

    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to fetch agents')
    }

    return result.data
  } catch (error) {
    console.error('[API Client] Error fetching agents:', error)
    throw error
  }
}

/**
 * Fetch single agent by ID from API route
 */
export async function fetchAgentById(id: string): Promise<Agent> {
  try {
    const response = await fetch(`/api/agents/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      next: { revalidate: 60 },
    })

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Agent not found')
      }
      throw new Error(`Failed to fetch agent: ${response.statusText}`)
    }

    const result: ApiResponse<Agent> = await response.json()

    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to fetch agent')
    }

    return result.data
  } catch (error) {
    console.error('[API Client] Error fetching agent:', error)
    throw error
  }
}

/**
 * Fetch all active credit packages from API route
 */
export async function fetchCreditPackages(): Promise<any[]> {
  try {
    const response = await fetch('/api/credit-packages/list', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      next: { revalidate: 300 }, // 5 minutes (pricing rarely changes)
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch credit packages: ${response.statusText}`)
    }

    const result: ApiResponse<any[]> = await response.json()

    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to fetch credit packages')
    }

    return result.data
  } catch (error) {
    console.error('[API Client] Error fetching credit packages:', error)
    throw error
  }
}

/**
 * Fetch all active credential platforms from API route
 */
export async function fetchCredentialPlatforms(): Promise<any[]> {
  try {
    const response = await fetch('/api/platforms/list', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      next: { revalidate: 3600 }, // 1 hour (platforms rarely change)
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch platforms: ${response.statusText}`)
    }

    const result: ApiResponse<any[]> = await response.json()

    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to fetch platforms')
    }

    return result.data
  } catch (error) {
    console.error('[API Client] Error fetching platforms:', error)
    throw error
  }
}

/**
 * Client-side fetch (for use in React components)
 * Does NOT use Next.js caching - relies on API route cache headers
 */
export const clientApi = {
  /**
   * Fetch agents (client-side)
   */
  async fetchAgents(): Promise<Agent[]> {
    const response = await fetch('/api/agents/list')
    if (!response.ok) {
      throw new Error('Failed to fetch agents')
    }
    const result: ApiResponse<Agent[]> = await response.json()
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to fetch agents')
    }
    return result.data
  },

  /**
   * Fetch single agent (client-side)
   */
  async fetchAgentById(id: string): Promise<Agent> {
    const response = await fetch(`/api/agents/${id}`)
    if (!response.ok) {
      throw new Error('Failed to fetch agent')
    }
    const result: ApiResponse<Agent> = await response.json()
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to fetch agent')
    }
    return result.data
  },

  /**
   * Fetch credit packages (client-side)
   */
  async fetchCreditPackages(): Promise<any[]> {
    const response = await fetch('/api/credit-packages/list')
    if (!response.ok) {
      throw new Error('Failed to fetch credit packages')
    }
    const result: ApiResponse<any[]> = await response.json()
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to fetch credit packages')
    }
    return result.data
  },

  /**
   * Fetch credential platforms (client-side)
   */
  async fetchCredentialPlatforms(): Promise<any[]> {
    const response = await fetch('/api/platforms/list')
    if (!response.ok) {
      throw new Error('Failed to fetch platforms')
    }
    const result: ApiResponse<any[]> = await response.json()
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to fetch platforms')
    }
    return result.data
  },
}

/**
 * Admin API client
 * TODO: Create separate admin API routes with authentication
 * For now, admin operations still blocked by RLS
 */
export const adminApi = {
  // Placeholder for future admin-specific API routes
  // These would use service_role and require admin authentication
}
