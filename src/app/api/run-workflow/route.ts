import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

// Create a function to call n8n workflow instead of importing a client
async function callN8nWorkflow(n8nWorkflowId: string | number, inputs: any) {
  const N8N_API_URL = process.env.N8N_API_URL;
  const N8N_API_KEY = process.env.N8N_API_KEY;

  if (!N8N_API_URL || !N8N_API_KEY) {
    throw new Error("N8N configuration is missing");
  }

  const res = await fetch(`${N8N_API_URL}/api/v1/workflows/${n8nWorkflowId}/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-N8N-API-KEY": N8N_API_KEY,
    },
    body: JSON.stringify({ input: inputs }),
    cache: "no-store",
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`n8n API error ${res.status}: ${txt}`);
  }

  return res.json();
}

export async function POST(req: Request) {
  try {
    const { workflowId, inputs } = await req.json();

    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    // 1) get workflow from Supabase by UUID (your app's workflow id)
    const { data: workflow, error: wfErr } = await supabase
      .from("workflows")
      .select("*")
      .eq("id", workflowId)
      .single();

    if (wfErr || !workflow) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    // 2) get user credits row
    const { data: userRow } = await supabase
      .from("users")
      .select("*")
      .eq("id", user.id)
      .single();

    if (!userRow) {
      return NextResponse.json({ error: "User profile missing" }, { status: 400 });
    }

    if (userRow.credits < workflow.credit_cost) {
      return NextResponse.json(
        { error: "Not enough credits to run this workflow" },
        { status: 402 }
      );
    }

    // 3) deduct credits
    await supabase
      .from("users")
      .update({ credits: userRow.credits - workflow.credit_cost })
      .eq("id", user.id);

    // 4) run n8n workflow using stored n8n_workflow_id
    const n8nResult = await callN8nWorkflow(workflow.n8n_workflow_id, inputs);

    // 5) save execution
    await supabase.from("executions").insert({
      user_id: user.id,
      workflow_id: workflow.id,
      status: "success",
      result: n8nResult,
    });

    return NextResponse.json({ result: n8nResult });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}