import { NextResponse } from "next/server";
import { fetchN8nWorkflows } from "@/lib/n8n-client";


export async function GET() {
  try {
    const workflows = await fetchN8nWorkflows();
    return NextResponse.json({ ok: true, workflows });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 500 }
    );
  }
}
