import { NextResponse } from "next/server";

// Inline the n8n functions to avoid top-level initialization issues
async function fetchN8nWorkflows() {
  const N8N_API_URL = process.env.N8N_API_URL;
  const N8N_API_KEY = process.env.N8N_API_KEY;

  if (!N8N_API_URL || !N8N_API_KEY) {
    throw new Error("N8N configuration is missing");
  }

  const res = await fetch(`${N8N_API_URL}/api/v1/workflows`, {
    headers: {
      "Content-Type": "application/json",
      "X-N8N-API-KEY": N8N_API_KEY,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`n8n API error ${res.status}: ${txt}`);
  }

  const json = await res.json();
  return json.data ?? json;
}

export async function GET() {
  try {
    const workflows = await fetchN8nWorkflows();
    return NextResponse.json({ workflows });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}