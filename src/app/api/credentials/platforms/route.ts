/**
 * Get All Platform Definitions API Route
 *
 * GET /api/credentials/platforms
 * Returns all available credential platforms
 */

import { NextResponse } from 'next/server';
import { getAllPlatformDefinitions } from '@/lib/credential-manager';
import { HTTP_STATUS } from '@/lib/constants';

export async function GET() {
  try {
    const platforms = await getAllPlatformDefinitions();

    return NextResponse.json({
      success: true,
      platforms: platforms || [],
    });
  } catch (error) {
    console.error('[API] Get all platforms error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve platform definitions' },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    );
  }
}
