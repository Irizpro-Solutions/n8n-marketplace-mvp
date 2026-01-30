/**
 * Get Platform Definition API Route
 *
 * GET /api/credentials/platform-definition?slug=wordpress
 * Returns field schema and metadata for a credential platform
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPlatformDefinition } from '@/lib/credential-manager';
import { HTTP_STATUS } from '@/lib/constants';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');

    if (!slug) {
      return NextResponse.json(
        { error: 'Platform slug is required' },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    const platform = await getPlatformDefinition(slug);

    if (!platform) {
      return NextResponse.json(
        { error: `Platform not found: ${slug}` },
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }

    return NextResponse.json({
      success: true,
      platform,
    });
  } catch (error) {
    console.error('[API] Get platform definition error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve platform definition' },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    );
  }
}
