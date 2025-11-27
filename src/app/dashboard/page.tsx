import { supabaseServer } from "@/lib/supabase/server";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await supabaseServer();  // ✅ FIXED (await added)

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return (
      <div className="p-6">
        <p>You are not logged in.</p>
        <Link href="/auth/login" className="underline">Go to Login</Link>
      </div>
    );
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("credits, full_name")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <main className="p-6 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            Welcome {profile?.full_name || user.email}
          </h1>
          <p className="text-sm text-muted-foreground">
            Run your n8n workflows with AI.
          </p>
        </div>

        <div className="rounded-xl bg-emerald-500/10 px-4 py-2 text-right">
          <p className="text-xs text-emerald-300 uppercase tracking-wide">
            Credit Balance
          </p>
          <p className="text-2xl font-semibold text-emerald-400">
            {profile?.credits ?? 0}
          </p>
        </div>
      </div>
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="text-muted-foreground">Welcome, {user.email}</p>

      <div className="flex gap-4">
        <Link href="/workflows" className="underline">Browse Workflows</Link>
        <Link href="/executions" className="underline">Execution History</Link>
        <Link href="https://yourdomain.com/api/razorpay/webhook" className="underline">Razorpay Webhook</Link>

      </div>
    </main>
  );
}
