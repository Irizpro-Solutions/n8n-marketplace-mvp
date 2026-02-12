"use client";

import { ReactNode } from "react";
import NeuralGrid from "./NeuralGrid";

interface ModernBackgroundProps {
  children: ReactNode;
  /** "landing" = slightly more visible effects, "dashboard" = very faint */
  variant?: "landing" | "dashboard";
}

export default function ModernBackground({
  children,
  variant = "dashboard",
}: ModernBackgroundProps) {
  // TUNING: Aurora gradient visibility — landing vs dashboard
  const auroraOpacity = variant === "landing" ? "opacity-[0.35]" : "opacity-[0.10]";

  return (
    <div className="min-h-screen bg-[#0F172A] relative overflow-hidden">
      {/* Secondary layer: subtle radial gradient for depth */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,#111827,transparent_70%)]" />

      {/* Subtle noise texture for depth — TUNING: opacity controls grain visibility */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "256px 256px",
        }}
      />

      {/* Aurora gradient layer: very slow moving */}
      <div
        className={`absolute inset-0 ${auroraOpacity}`}
        style={{
          background:
            "linear-gradient(135deg, rgba(59,130,246,0.6) 0%, rgba(139,92,246,0.4) 40%, rgba(250,204,21,0.08) 70%, rgba(59,130,246,0.5) 100%)",
          backgroundSize: "400% 400%",
          animation: "aurora-drift 15s ease-in-out infinite",
        }}
      />

      {/* Neural grid canvas */}
      <NeuralGrid variant={variant} />

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
