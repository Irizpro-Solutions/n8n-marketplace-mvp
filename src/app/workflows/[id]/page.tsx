// src/app/workflows/[id]/page.tsx
import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import RunWorkflowForm from "./run-form";

interface WorkflowDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function WorkflowDetailPage({
  params,
}: WorkflowDetailPageProps) {
  const { id } = await params;
  const supabase = await supabaseServer();

  const { data: workflow, error } = await supabase
    .from("workflows")
    .select("*")
    .eq("id", id)
    .eq("is_active", true)
    .single();

  if (error || !workflow) {
    console.error("Workflow fetch error:", error);
    return (
      <main className="p-6">
        <h1 className="text-xl font-semibold">Workflow not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This workflow is not available.{" "}
          <Link href="/workflows" className="underline">
            Back to all workflows
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-3xl font-bold">{workflow.name}</h1>
      {workflow.description && (
        <p className="text-muted-foreground">{workflow.description}</p>
      )}
      <p className="text-sm">
        <strong>Credits required:</strong> {workflow.credit_cost}
      </p>

      {/* This is your existing form that calls /api/run-workflow */}
      <RunWorkflowForm workflow={workflow} />
    </main>
  );
}
