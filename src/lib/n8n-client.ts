export async function runN8nWorkflow(webhookUrl: string, inputs: any) {
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(inputs),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error("n8n workflow failed: " + err);
    }

    return await res.json();
  } catch (err: any) {
    console.error("Error calling n8n:", err);
    throw err;
  }
}
