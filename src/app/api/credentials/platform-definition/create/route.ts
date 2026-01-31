import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { handleError, AuthenticationError, ValidationError } from '@/lib/error-handler';
import { HTTP_STATUS } from '@/lib/constants';

const ADMIN_EMAIL = 'team@irizpro.com';

interface FieldDefinition {
  name: string;
  label: string;
  type: string;
  required: boolean;
  placeholder?: string;
  help_text?: string;
}

/**
 * Create custom credential platform definition (Admin only)
 * POST /api/credentials/platform-definition/create
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate
    const supabase = await supabaseServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new AuthenticationError();
    }

    // 2. Check admin access
    if (user.email !== ADMIN_EMAIL) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }

    // 3. Parse request
    const body = await req.json();
    const {
      platform_slug,
      platform_name,
      credential_type,
      field_schema,
      description,
      setup_instructions,
    } = body;

    // 4. Validate
    if (!platform_slug || !platform_name || !credential_type || !field_schema) {
      throw new ValidationError(
        'Missing required fields: platform_slug, platform_name, credential_type, field_schema'
      );
    }

    if (!Array.isArray(field_schema) || field_schema.length === 0) {
      throw new ValidationError('field_schema must be a non-empty array');
    }

    // Validate field schema structure
    for (const field of field_schema) {
      if (!field.name || !field.label || !field.type) {
        throw new ValidationError('Each field must have name, label, and type');
      }
    }

    // 5. Check for existing platform with same slug
    const { data: existing } = await supabaseAdmin
      .from('credential_platform_definitions')
      .select('platform_slug')
      .eq('platform_slug', platform_slug)
      .maybeSingle();

    if (existing) {
      throw new ValidationError(`Platform with slug "${platform_slug}" already exists`);
    }

    // 6. Insert new platform definition
    const { data, error: insertError } = await supabaseAdmin
      .from('credential_platform_definitions')
      .insert({
        platform_slug,
        platform_name,
        credential_type,
        field_schema,
        description: description || null,
        setup_instructions: setup_instructions || null,
        is_active: true,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      throw new Error('Failed to create platform definition');
    }

    return NextResponse.json({
      success: true,
      message: 'Custom platform created successfully',
      platform: data,
    }, { status: HTTP_STATUS.OK });

  } catch (error) {
    return handleError(error);
  }
}
