import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { runN8nWorkflow } from "@/lib/n8n-client"; // your helper

export async function POST(req: Request) {
  try {
    const { workflowId, inputs } = await req.json();

    const supabase = await supabaseServer();

    // 1) get logged-in user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2) fetch workflow row by UUID
    const { data: workflow, error } = await supabase
      .from("workflows")
      .select("*")
      .eq("id", workflowId)
      .eq("is_active", true)
      .single();

    if (error || !workflow) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    // 3) make sure n8n_workflow_id exists
    if (!workflow.n8n_workflow_id) {
      return NextResponse.json(
        { error: "n8n workflow id missing in DB" },
        { status: 400 }
      );
    }

    // 4) check credits
    const { data: userRow } = await supabase
      .from("users")
      .select("credits")
      .eq("id", user.id)
      .single();

    const credits = userRow?.credits ?? 0;
    if (credits < workflow.credit_cost) {
      return NextResponse.json(
        { error: "Not enough credits to run this workflow" },
        { status: 402 }
      );
    }

    // 5) call n8n using slug
    const n8nResult = await runN8nWorkflow(
      workflow.n8n_workflow_id,
      inputs
    );

    // 6) deduct credits
    await supabase
      .from("users")
      .update({ credits: credits - workflow.credit_cost })
      .eq("id", user.id);

    return NextResponse.json({ success: true, data: n8nResult });

  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
