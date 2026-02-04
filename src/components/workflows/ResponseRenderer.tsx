"use client";

import { useState, useRef } from "react";
import { Download } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

interface ResponseRendererProps {
  response: any;
  title?: string;
  className?: string;
  showDownload?: boolean;
  cleanMode?: boolean; // New prop to hide all UI chrome
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
  showDownload = true,
  cleanMode = false,
}: ResponseRendererProps) {
  const [viewMode, setViewMode] = useState<"rendered" | "raw">("rendered");
  const contentRef = useRef<HTMLDivElement>(null);

  const downloadAsPDF = async () => {
    if (!contentRef.current) return;

    try {
      // Show loading message
      const loadingMsg = document.createElement('div');
      loadingMsg.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.8);color:white;padding:20px 40px;border-radius:10px;z-index:9999;font-size:16px;';
      loadingMsg.textContent = 'Generating PDF... Please wait';
      document.body.appendChild(loadingMsg);

      // Clone the element to avoid modifying the displayed content
      const element = contentRef.current;
      const clone = element.cloneNode(true) as HTMLElement;

      // Create temporary container for the clone
      const tempContainer = document.createElement('div');
      tempContainer.style.cssText = 'position:absolute;left:-9999px;top:0;width:800px;';
      document.body.appendChild(tempContainer);
      tempContainer.appendChild(clone);

      // Replace unsupported CSS colors in the clone
      const allElements = clone.querySelectorAll('*');
      allElements.forEach((el: any) => {
        if (el.style) {
          const style = el.style.cssText;
          if (style.includes('lab(')) {
            // Replace lab() colors with rgb equivalents or remove them
            el.style.cssText = style.replace(/lab\([^)]+\)/g, 'rgb(147, 51, 234)'); // Use purple as fallback
          }
        }
      });

      // Capture the HTML as canvas
      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 800,
      });

      // Clean up temp container
      document.body.removeChild(tempContainer);

      // Calculate PDF dimensions
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      // Create PDF
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      let heightLeft = imgHeight;
      let position = 0;
      let page = 1;

      // Add first page
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // Add additional pages if needed
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
        page++;
      }

      // Save the PDF
      pdf.save(`SEO-Report-${new Date().toISOString().split('T')[0]}.pdf`);

      // Remove loading message
      document.body.removeChild(loadingMsg);

      // Show success message
      const successMsg = document.createElement('div');
      successMsg.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(16,185,129,0.9);color:white;padding:15px 30px;border-radius:10px;z-index:9999;font-size:14px;';
      successMsg.textContent = `✓ PDF downloaded successfully! (${page} page${page > 1 ? 's' : ''})`;
      document.body.appendChild(successMsg);
      setTimeout(() => document.body.removeChild(successMsg), 3000);

    } catch (error) {
      console.error('PDF generation error:', error);
      alert('Failed to generate PDF. Error: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  // Handle raw response from parse errors
  const actualResponse = response?._parseError && response?.rawResponse
    ? response.rawResponse
    : response;

  // Debug logging
  console.log('[ResponseRenderer] Received response:', {
    type: typeof actualResponse,
    isArray: Array.isArray(actualResponse),
    keys: typeof actualResponse === 'object' ? Object.keys(actualResponse) : null,
    preview: JSON.stringify(actualResponse)?.substring(0, 200),
  });

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

  const htmlContent = extractHtml(actualResponse);
  const simpleMessage = isSimpleMessage(actualResponse) ? actualResponse : null;

  // Clean mode - just show HTML with download button
  if (cleanMode && htmlContent) {
    return (
      <div className={`relative ${className}`}>
        {showDownload && (
          <div className="absolute top-4 right-4 z-10 flex gap-2">
            <button
              onClick={downloadAsPDF}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700 text-white rounded-lg shadow-lg transition-all font-medium"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </button>
          </div>
        )}
        <div
          ref={contentRef}
          className="overflow-auto max-h-[70vh] bg-white rounded-lg"
          dangerouslySetInnerHTML={{ __html: htmlContent }}
          style={{
            wordWrap: "break-word",
            overflowWrap: "break-word",
          }}
        />
      </div>
    );
  }

  // Standard mode - with all UI chrome
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
              ref={contentRef}
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
              {typeof actualResponse === 'string'
                ? actualResponse
                : JSON.stringify(actualResponse, null, 2)}
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
