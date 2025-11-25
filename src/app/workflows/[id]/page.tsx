import { supabaseServer } from "@/lib/supabase/server";
import RunWorkflowForm from "./run-form";
import Link from "next/link";

export default async function WorkflowDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await supabaseServer();

  const { data: workflow, error } = await supabase
    .from("workflows")
    .select("*")
    .eq("id", id)
    .eq("is_active", true)
    .single();

  if (error || !workflow) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-xl font-bold">Workflow not found</h1>
        {error && (
          <p className="text-sm text-red-600 mt-2">{error.message}</p>
        )}
        <Link href="/workflows" className="underline mt-4 inline-block">
          ← Back to Workflows
        </Link>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/40">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Back link */}
        <Link
          href="/workflows"
          className="text-sm text-muted-foreground hover:text-foreground transition"
        >
          ← Back to marketplace
        </Link>

        {/* Hero card */}
        <div className="rounded-2xl border bg-background p-6 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                {workflow.name}
              </h1>
              <p className="text-muted-foreground mt-2">
                {workflow.description}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="rounded-full bg-primary/10 text-primary px-4 py-2 text-sm font-semibold">
                {workflow.credit_cost} Credits / Run
              </div>
            </div>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="rounded-md bg-muted px-2 py-1">AI Agent</span>
            <span className="rounded-md bg-muted px-2 py-1">SEO / Content</span>
            <span className="rounded-md bg-muted px-2 py-1">n8n Workflow</span>
            <span className="rounded-md bg-muted px-2 py-1">MVP</span>
          </div>
        </div>

        {/* Form */}
        <RunWorkflowForm workflow={workflow} />
      </div>
    </main>
  );
}









// import { supabaseServer } from "@/lib/supabase/server";
// import RunWorkflowForm from "./run-form";

// export default async function WorkflowDetailPage({
//   params,
// }: {
//   params: Promise<{ id: string }>;
// }) {
//   const { id } = await params; // ✅ Next 16 requires this
//   const supabase = await supabaseServer();

//   const { data: workflow, error } = await supabase
//     .from("workflows")
//     .select("*")
//     .eq("id", id)
//     .eq("is_active", true) // ✅ keep explicit
//     .single();

//   if (error || !workflow) {
//     console.log("Workflow fetch error:", error);
//     return (
//       <div className="p-6">
//         <h1 className="text-xl font-bold">Workflow not found</h1>
//         {error && (
//           <p className="text-sm text-red-600 mt-2">{error.message}</p>
//         )}
//       </div>
//     );
//   }

//   return (
//     <main className="p-6 space-y-4">
//       <h1 className="text-2xl font-bold">{workflow.name}</h1>
//       <p className="text-muted-foreground">{workflow.description}</p>
//       <p className="text-sm">
//         <strong>Credits required:</strong> {workflow.credit_cost}
//       </p>

//       <RunWorkflowForm workflow={workflow} />
//     </main>
//   );
// }
