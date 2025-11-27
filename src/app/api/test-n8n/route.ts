import { NextResponse } from "next/server";
import { fetchN8nWorkflows } from "@/lib/n8n-client";

export async function GET() {
  try {
    const workflows = await fetchN8nWorkflows();
    return NextResponse.json({ workflows });
  } catch (e:any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
