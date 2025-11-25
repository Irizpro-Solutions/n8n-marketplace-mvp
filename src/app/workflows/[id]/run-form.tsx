"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Field = {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "textarea";
  required?: boolean;
  options?: string[];
  placeholder?: string;
};

export default function RunWorkflowForm({ workflow }: any) {
  const schema = workflow.input_schema;
  const fields: Field[] = schema?.fields || [];

  const [formData, setFormData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (key: string, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleRun = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`/api/run-workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflowId: workflow.id,
          inputs: formData,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to run workflow");

      setResult(data);
    } catch (e: any) {
      setError(e.message);
    }

    setLoading(false);
  };

  return (
    <div className="rounded-2xl border bg-background p-6 shadow-sm space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Enter Inputs</h2>
        <span className="text-xs text-muted-foreground">
          All fields sync with n8n
        </span>
      </div>

      {/* Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {fields.map((f) => (
          <div key={f.key} className="space-y-1.5">
            <label className="text-sm font-medium">
              {f.label}
              {f.required && <span className="text-red-500"> *</span>}
            </label>

            {f.type === "text" || f.type === "number" ? (
              <Input
                type={f.type}
                required={f.required}
                placeholder={f.placeholder || f.label}
                onChange={(e) => handleChange(f.key, e.target.value)}
                className="rounded-xl"
              />
            ) : f.type === "textarea" ? (
              <textarea
                className="w-full rounded-xl border bg-background p-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30 min-h-[96px]"
                required={f.required}
                placeholder={f.placeholder || f.label}
                onChange={(e) => handleChange(f.key, e.target.value)}
              />
            ) : f.type === "select" ? (
              <select
                className="w-full rounded-xl border bg-background p-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                required={f.required}
                onChange={(e) => handleChange(f.key, e.target.value)}
              >
                <option value="">Select...</option>
                {f.options?.map((op) => (
                  <option key={op} value={op}>
                    {op}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
        ))}
      </div>

      {/* CTA row */}
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <Button
          onClick={handleRun}
          disabled={loading}
          className="rounded-xl px-6 py-5 text-base font-semibold"
        >
          {loading ? "Running Workflow..." : "Run Workflow"}
        </Button>

        <div className="text-xs text-muted-foreground">
          Credits will be deducted automatically after successful run.
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="rounded-xl border bg-muted/40 p-4 space-y-2">
          <div className="text-sm font-semibold">Execution Result</div>
          <pre className="bg-black text-white p-3 rounded-lg text-xs overflow-auto max-h-[420px]">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}



















// "use client";

// import { useState } from "react";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";

// type Field = {
//   key: string;
//   label: string;
//   type: "text" | "number" | "select" | "textarea";
//   required?: boolean;
//   options?: string[];
// };

// export default function RunWorkflowForm({ workflow }: any) {
//   const schema = workflow.input_schema;
//   const fields: Field[] = schema?.fields || [];

//   const [formData, setFormData] = useState<Record<string, any>>({});
//   const [loading, setLoading] = useState(false);
//   const [result, setResult] = useState<any>(null);
//   const [error, setError] = useState<string | null>(null);

//   const handleChange = (key: string, value: any) => {
//     setFormData((prev) => ({ ...prev, [key]: value }));
//   };

//   const handleRun = async () => {
//     setLoading(true);
//     setError(null);
//     setResult(null);

//     try {
//       const res = await fetch(`/api/run-workflow`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           workflowId: workflow.id,
//           inputs: formData,
//         }),
//       });

//       const data = await res.json();

//       if (!res.ok) throw new Error(data.error || "Failed to run workflow");

//       setResult(data);
//     } catch (e: any) {
//       setError(e.message);
//     }

//     setLoading(false);
//   };

//   return (
//     <div className="space-y-4 border rounded p-4">
//       <h2 className="text-lg font-semibold">Enter Inputs</h2>

//       {fields.map((f) => (
//         <div key={f.key} className="space-y-1">
//           <label className="text-sm font-medium">{f.label}</label>

//           {f.type === "text" || f.type === "number" ? (
//             <Input
//               type={f.type}
//               required={f.required}
//               placeholder={f.label}
//               onChange={(e) => handleChange(f.key, e.target.value)}
//             />
//           ) : f.type === "textarea" ? (
//             <textarea
//               className="w-full border rounded p-2 text-sm"
//               required={f.required}
//               placeholder={f.label}
//               onChange={(e) => handleChange(f.key, e.target.value)}
//             />
//           ) : f.type === "select" ? (
//             <select
//               className="w-full border rounded p-2 text-sm"
//               required={f.required}
//               onChange={(e) => handleChange(f.key, e.target.value)}
//             >
//               <option value="">Select...</option>
//               {f.options?.map((op) => (
//                 <option key={op} value={op}>
//                   {op}
//                 </option>
//               ))}
//             </select>
//           ) : null}
//         </div>
//       ))}

//       <Button onClick={handleRun} disabled={loading}>
//         {loading ? "Running..." : "Run Workflow"}
//       </Button>

//       {error && <p className="text-sm text-red-600">{error}</p>}

//       {result && (
//         <pre className="bg-black text-white p-3 rounded text-xs overflow-auto">
//           {JSON.stringify(result, null, 2)}
//         </pre>
//       )}
//     </div>
//   );
// }
