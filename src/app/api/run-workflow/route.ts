/**
 * Workflow Execution Route
 * Handles workflow execution with atomic credit deduction
 *
 * Security Features:
 * - Atomic credit deduction (no race conditions)
 * - Rate limiting (30 requests/minute)
 * - Input validation with Zod
 * - Audit logging
 * - Agent access verification
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  asyncHandler,
  successResponse,
  ResourceNotFoundError,
  PaymentError,
  AuthenticationError,
} from '@/lib/error-handler';
import { runWorkflowSchema } from '@/lib/validation-schemas';
import { withRateLimit, workflowRateLimiter } from '@/lib/rate-limiter';
import {
  getAgentById,
  hasUserPurchasedAgent,
  recordExecution,
  updateExecutionResult,
  recordAuditLog,
} from '@/lib/database-utils';
import {
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  HTTP_STATUS,
  DATABASE,
  EXECUTION,
  AUDIT_LOG,
  API,
  USER,
} from '@/lib/constants';
import { retrieveAllAgentCredentials } from '@/lib/credential-manager';

/**
 * Calls n8n webhook directly with timeout and error handling
 * Formats payload for webhook-triggered workflows
 */
async function callN8nWebhook(
  webhookUrl: string,
  inputs: Record<string, unknown>,
  credentials?: Record<string, any>,
  userId?: string,
  userEmail?: string
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API.TIMEOUT.N8N_REQUEST);

  try {
    // Build n8n webhook payload
    // This is the structure your n8n webhook will receive
    const payload: any = {
      // User inputs (form data)
      inputs: inputs,

      // User context
      user: {
        id: userId,
        email: userEmail,
      },
    };

    // Inject credentials if provided (grouped by platform)
    if (credentials && Object.keys(credentials).length > 0) {
      payload.credentials = credentials;
    }

    console.log('[N8N] Calling webhook', {
      webhook_url: webhookUrl,
      has_credentials: !!credentials,
      credential_platforms: credentials ? Object.keys(credentials) : [],
      input_count: Object.keys(inputs).length,
    });

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`n8n webhook error ${res.status}: ${errorText}`);
    }

    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Calls n8n workflow via API with timeout and error handling
 * @deprecated Use callN8nWebhook instead for webhook-triggered workflows
 */
async function callN8nWorkflow(
  n8nWorkflowId: string | number,
  inputs: Record<string, unknown>,
  credentials?: Record<string, any>,
  userId?: string,
  userEmail?: string
) {
  const N8N_API_URL = process.env.N8N_API_URL;
  const N8N_API_KEY = process.env.N8N_API_KEY;

  if (!N8N_API_URL || !N8N_API_KEY) {
    throw new Error('N8N configuration is missing');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API.TIMEOUT.N8N_REQUEST);

  try {
    // Build n8n webhook payload
    // This is the structure your n8n webhook will receive
    const payload: any = {
      // User inputs (form data)
      inputs: inputs,

      // User context
      user: {
        id: userId,
        email: userEmail,
      },
    };

    // Inject credentials if provided (grouped by platform)
    if (credentials && Object.keys(credentials).length > 0) {
      payload.credentials = credentials;
    }

    console.log('[N8N] Calling workflow', {
      workflow_id: n8nWorkflowId,
      has_credentials: !!credentials,
      credential_platforms: credentials ? Object.keys(credentials) : [],
    });

    const res = await fetch(
      `${N8N_API_URL}/api/v1/workflows/${n8nWorkflowId}/run`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-N8N-API-KEY': N8N_API_KEY,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      }
    );

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`n8n API error ${res.status}: ${errorText}`);
    }

    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

export const POST = withRateLimit(
  workflowRateLimiter,
  asyncHandler(async (req: NextRequest) => {
    // 1. Validate request body
    const validatedData = await req.json().then((data) =>
      runWorkflowSchema.parse(data)
    );

    const { agentId, inputs = {} } = validatedData;

    // 2. Authenticate user
    const supabase = await supabaseServer();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new AuthenticationError(ERROR_MESSAGES.AUTH.UNAUTHORIZED);
    }

    // 3. Check if user is admin
    const isAdmin = user.email === USER.ADMIN.EMAIL;

    // 4. Get agent details
    const agent = await getAgentById(agentId);

    if (!agent.is_active) {
      throw new ResourceNotFoundError(ERROR_MESSAGES.WORKFLOW.AGENT_INACTIVE);
    }

    // 5. Verify user has purchased this agent (skip for admin)
    if (!isAdmin) {
      const hasPurchased = await hasUserPurchasedAgent(user.id, agentId);

      if (!hasPurchased) {
        throw new PaymentError(
          'You must purchase this agent before using it',
          'AGENT_NOT_PURCHASED'
        );
      }
    }

    // 6. Get webhook URL from agent
    const webhookUrl = agent.webhook_url;

    if (!webhookUrl || !webhookUrl.trim()) {
      throw new ResourceNotFoundError('Webhook URL not configured for this agent');
    }

    const creditCost = isAdmin ? 0 : (agent.credit_cost || 0);

    // 7. Create execution record (pending status)
    const executionId = await recordExecution({
      userId: user.id,
      agentId: agent.id,
      workflowId: webhookUrl, // Store webhook URL for reference
      inputs,
      credits_used: creditCost,
      status: EXECUTION.STATUS.PENDING,
    });

    // 8. Deduct credits (skip for admin)
    let deductResult: any = { success: true, new_balance: 0 };

    if (!isAdmin && creditCost > 0) {
      // Atomically deduct credits (prevents race conditions)
      const { data: result, error: rpcError } = await supabaseAdmin.rpc(
        DATABASE.RPC.DEDUCT_CREDITS_ATOMIC,
        {
          p_user_id: user.id,
          p_amount: creditCost,
          p_agent_id: agentId,
          p_execution_id: executionId,
        }
      );

      // Check if deduction was successful
      if (rpcError || !result || !result.success) {
        const errorMessage = rpcError?.message || result?.error || 'Unknown error';

        // Update execution with failure
        await updateExecutionResult(
          executionId,
          EXECUTION.STATUS.FAILED,
          null,
          `Credit deduction failed: ${errorMessage}`
        );

        // Check if insufficient credits
        if (errorMessage.includes('Insufficient credits')) {
          throw new PaymentError(
            ERROR_MESSAGES.PAYMENT.INSUFFICIENT_CREDITS,
            'INSUFFICIENT_CREDITS'
          );
        }

        throw new PaymentError(errorMessage);
      }

      deductResult = result;

      console.log('[WORKFLOW] Credits deducted successfully', {
        user_id: user.id,
        agent_id: agentId,
        credits_deducted: creditCost,
        new_balance: deductResult.new_balance,
        execution_id: executionId,
      });
    } else if (isAdmin) {
      console.log('[WORKFLOW] Admin user - skipping credit deduction', {
        user_id: user.id,
        agent_id: agentId,
        execution_id: executionId,
      });
    }

    // 9. Retrieve user credentials for this agent (platform-based)
    let userCredentials: Record<string, any> | undefined;
    try {
      const credentialMap = await retrieveAllAgentCredentials(user.id, agentId);

      if (Object.keys(credentialMap).length > 0) {
        // Transform credential map to n8n-friendly format
        // From: { "wordpress": { platform: "wordpress", type: "basic_auth", credentials: {...} } }
        // To: { "wordpress": { site_url: "...", username: "...", application_password: "..." } }
        userCredentials = {};

        for (const [platformSlug, credData] of Object.entries(credentialMap)) {
          userCredentials[platformSlug] = {
            ...credData.credentials,  // Spread the actual credential values
            ...(credData.metadata || {}),  // Add metadata (site_url, account_name, etc.)
          };
        }

        console.log('[CREDENTIALS] User credentials retrieved for agent', {
          agent_id: agentId,
          platforms: Object.keys(credentialMap),
          credential_count: Object.keys(credentialMap).length,
        });
      } else {
        console.log('[CREDENTIALS] No credentials found for agent', {
          agent_id: agentId,
        });
      }
    } catch (error) {
      console.warn('[CREDENTIALS] Failed to retrieve credentials', {
        agent_id: agentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Continue without credentials (agent may not require them)
    }

    // 10. Execute n8n workflow
    let workflowResult;
    let executionStatus: string = EXECUTION.STATUS.SUCCESS;
    let executionError: string | undefined;

    try {
      // Update execution status to running
      await updateExecutionResult(
        executionId,
        EXECUTION.STATUS.RUNNING,
        undefined,
        undefined
      );

      workflowResult = await callN8nWebhook(
        webhookUrl,
        inputs,
        userCredentials,
        user.id,
        user.email
      );

      console.log('[WORKFLOW] Execution completed successfully', {
        execution_id: executionId,
        agent_id: agentId,
      });
    } catch (error) {
      executionStatus = EXECUTION.STATUS.FAILED;
      executionError = error instanceof Error ? error.message : 'Unknown error';

      console.error('[WORKFLOW] Execution failed', {
        execution_id: executionId,
        error: executionError,
      });

      // Note: Credits are NOT refunded on failure (by design)
      // You may want to implement a refund policy here
    }

    // 11. Update execution with result
    await updateExecutionResult(
      executionId,
      executionStatus,
      workflowResult,
      executionError
    );

    // 12. Record audit log
    await recordAuditLog({
      userId: user.id,
      action: AUDIT_LOG.ACTION.WORKFLOW_EXECUTION,
      resource: AUDIT_LOG.RESOURCE.WORKFLOW,
      resourceId: executionId,
      details: {
        agent_id: agentId,
        agent_name: agent.name,
        credits_used: creditCost,
        new_balance: deductResult.new_balance,
        status: executionStatus,
        error: executionError,
      },
      ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
      userAgent: req.headers.get('user-agent') || undefined,
    });

    // 13. Return result
    if (executionStatus === EXECUTION.STATUS.FAILED) {
      throw new Error(
        executionError || ERROR_MESSAGES.WORKFLOW.EXECUTION_FAILED
      );
    }

    return successResponse(
      {
        success: true,
        message: SUCCESS_MESSAGES.WORKFLOW.EXECUTED,
        data: {
          execution_id: executionId,
          result: workflowResult,
          credits_used: creditCost,
          remaining_credits: deductResult.new_balance,
        },
      },
      HTTP_STATUS.OK
    );
  })
);
