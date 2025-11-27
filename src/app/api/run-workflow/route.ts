import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { runN8nWorkflow } from "@/lib/n8n-client";

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

    // 1) get workflow from Supabase by UUID (your app’s workflow id)
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
    const n8nResult = await runN8nWorkflow(workflow.n8n_workflow_id, inputs);

    // 5) save execution
    await supabase.from("executions").insert({
      user_id: user.id,
      workflow_id: workflow.id,
      status: "success",
      result: n8nResult,
    });

    return NextResponse.json({ result: n8nResult });
  } catch (e:any) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
