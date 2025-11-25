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

  return (
    <main className="p-6 space-y-3">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="text-muted-foreground">Welcome, {user.email}</p>

      <div className="flex gap-4">
        <Link href="/workflows" className="underline">Browse Workflows</Link>
        <Link href="/executions" className="underline">Execution History</Link>
      </div>
    </main>
  );
}
