"use client";

import { useState } from "react";

interface ResponseRendererProps {
  response: any;
  title?: string;
  className?: string;
}

/**
 * Smart Response Renderer
 * Handles different n8n webhook response formats:
 * - HTML content (renders as HTML)
 * - JSON objects (formatted JSON viewer)
 * - Simple messages (styled text)
 * - Arrays with HTML (extracts and renders)
 */
export default function ResponseRenderer({
  response,
  title = "Execution Result",
  className = "",
}: ResponseRendererProps) {
  const [viewMode, setViewMode] = useState<"rendered" | "raw">("rendered");

  // Extract HTML from various response formats
  const extractHtml = (data: any): string | null => {
    // Format 1: Array with html key: [["html": "<html>"]]
    if (Array.isArray(data) && data.length > 0) {
      const firstItem = data[0];
      if (Array.isArray(firstItem) && firstItem.length > 0) {
        const htmlItem = firstItem[0];
        if (typeof htmlItem === "object" && htmlItem?.html) {
          return htmlItem.html;
        }
      }
      // Format 2: Array of objects: [{ html: "<html>" }]
      if (typeof firstItem === "object" && firstItem?.html) {
        return firstItem.html;
      }
    }

    // Format 3: Direct object: { html: "<html>" }
    if (typeof data === "object" && data?.html) {
      return data.html;
    }

    // Format 4: Nested in result: { result: { html: "<html>" } }
    if (typeof data === "object" && data?.result?.html) {
      return data.result.html;
    }

    // Format 5: Direct HTML string
    if (typeof data === "string" && data.trim().startsWith("<")) {
      return data;
    }

    return null;
  };

  // Check if response is a simple message
  const isSimpleMessage = (data: any): boolean => {
    return (
      typeof data === "string" &&
      !data.trim().startsWith("<") &&
      !data.trim().startsWith("{") &&
      !data.trim().startsWith("[")
    );
  };

  const htmlContent = extractHtml(response);
  const simpleMessage = isSimpleMessage(response) ? response : null;

  return (
    <div className={`rounded-xl border bg-muted/40 p-4 space-y-3 ${className}`}>
      {/* Header with view toggle */}
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">{title}</div>

        {htmlContent && (
          <div className="flex gap-1 bg-background rounded-lg p-1">
            <button
              onClick={() => setViewMode("rendered")}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                viewMode === "rendered"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Rendered
            </button>
            <button
              onClick={() => setViewMode("raw")}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                viewMode === "raw"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Raw JSON
            </button>
          </div>
        )}
      </div>

      {/* Content area */}
      <div className="relative">
        {htmlContent && viewMode === "rendered" ? (
          // HTML Rendering Mode
          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="p-2 bg-muted/50 border-b flex items-center gap-2 text-xs text-muted-foreground">
              <svg
                className="w-3 h-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                />
              </svg>
              <span>HTML Output</span>
            </div>
            <div
              className="p-4 overflow-auto max-h-[600px]"
              dangerouslySetInnerHTML={{ __html: htmlContent }}
              style={{
                // Ensure rendered HTML doesn't break layout
                wordWrap: "break-word",
                overflowWrap: "break-word",
              }}
            />
          </div>
        ) : simpleMessage ? (
          // Simple Message Mode
          <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
            <p className="text-green-700 dark:text-green-300 font-medium">
              {simpleMessage}
            </p>
          </div>
        ) : (
          // JSON Viewer Mode
          <div className="bg-black rounded-lg overflow-hidden">
            <div className="p-2 bg-zinc-800 border-b border-zinc-700 flex items-center gap-2 text-xs text-zinc-400">
              <svg
                className="w-3 h-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
              <span>JSON Response</span>
            </div>
            <pre className="text-white p-4 text-xs overflow-auto max-h-[600px] leading-relaxed">
              {JSON.stringify(response, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Info footer for HTML rendering */}
      {htmlContent && viewMode === "rendered" && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <svg
            className="w-3 h-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>
            Displaying rendered HTML output from workflow. Switch to "Raw JSON" to see the full response.
          </span>
        </div>
      )}
    </div>
  );
}
