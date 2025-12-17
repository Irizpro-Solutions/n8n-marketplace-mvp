// Fixed src/lib/n8n-client.ts

type N8nWorkflow = {
  id: string | number;
  name: string;
  active?: boolean;
  tags?: any[];
};

// Create helper function to check environment variables
function validateN8nConfig() {
  const N8N_API_URL = process.env.N8N_API_URL;
  const N8N_API_KEY = process.env.N8N_API_KEY;

  if (!N8N_API_URL || !N8N_API_KEY) {
    throw new Error('N8N_API_URL and N8N_API_KEY environment variables are required');
  }

  return { N8N_API_URL, N8N_API_KEY };
}

// helper
async function n8nFetch(path: string, options: RequestInit = {}) {
  const { N8N_API_URL, N8N_API_KEY } = validateN8nConfig();

  const res = await fetch(`${N8N_API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-N8N-API-KEY": N8N_API_KEY,
      ...(options.headers || {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`n8n API error ${res.status}: ${txt}`);
  }

  return res.json();
}

// ✅ list workflows from n8n
export async function fetchN8nWorkflows(): Promise<N8nWorkflow[]> {
  // n8n returns { data: [...] } in most versions
  const json = await n8nFetch(`/api/v1/workflows`);
  return json.data ?? json;
}

// ✅ run a workflow by n8n workflow id
export async function runN8nWorkflow(n8nWorkflowId: string | number, inputs: any) {
  // Most n8n versions support POST /workflows/:id/run
  return n8nFetch(`/api/v1/workflows/${n8nWorkflowId}/run`, {
    method: "POST",
    body: JSON.stringify({ input: inputs }),
  });
}

// Create a factory function for n8n client if needed
export function createN8nClient() {
  const { N8N_API_URL, N8N_API_KEY } = validateN8nConfig();
  
  return {
    apiUrl: N8N_API_URL,
    apiKey: N8N_API_KEY,
    fetchWorkflows: fetchN8nWorkflows,
    runWorkflow: runN8nWorkflow,
  };
}