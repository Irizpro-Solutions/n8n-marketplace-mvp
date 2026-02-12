"use client";

import { useEffect, useRef } from "react";

interface Node {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  radius: number;
  pulsePhase: number;
  pulseSpeed: number;
  hasPulse: boolean;
  connections: number[];
}

interface NeuralGridProps {
  /** "landing" = slightly more visible, "dashboard" = very faint */
  variant?: "landing" | "dashboard";
}

export default function NeuralGrid({ variant = "dashboard" }: NeuralGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const nodesRef = useRef<Node[]>([]);
  const initializedRef = useRef(false);

  const opacity = variant === "landing" ? 1 : 0.7;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Regenerate nodes on resize
      generateNodes();
    }

    function generateNodes() {
      const nodes: Node[] = [];
      // Create a structured but organic grid of nodes
      const spacing = variant === "landing" ? 150 : 140;
      const cols = Math.ceil(width / spacing) + 2;
      const rows = Math.ceil(height / spacing) + 2;

      for (let row = -1; row < rows; row++) {
        for (let col = -1; col < cols; col++) {
          // Offset every other row for a more organic feel
          const offsetX = row % 2 === 0 ? 0 : spacing * 0.5;
          const baseX = col * spacing + offsetX;
          const baseY = row * spacing;

          // Add slight randomness to position (structured but not rigid)
          const jitterX = (Math.random() - 0.5) * spacing * 0.3;
          const jitterY = (Math.random() - 0.5) * spacing * 0.3;

          const hasPulse = Math.random() < 0.25; // 15% of nodes pulse amber

          nodes.push({
            x: baseX + jitterX,
            y: baseY + jitterY,
            baseX: baseX + jitterX,
            baseY: baseY + jitterY,
            radius: 1.2 + Math.random() * 0.8,
            pulsePhase: Math.random() * Math.PI * 2,
            pulseSpeed: 0.15 + Math.random() * 0.15, // 3-6 second cycle
            hasPulse,
            connections: [],
          });
        }
      }

      // Create connections between nearby nodes
      const maxDist = spacing * 1.6;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].baseX - nodes[j].baseX;
          const dy = nodes[i].baseY - nodes[j].baseY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < maxDist) {
            nodes[i].connections.push(j);
          }
        }
      }

      nodesRef.current = nodes;
      initializedRef.current = true;
    }

    function draw(time: number) {
      if (!ctx || !initializedRef.current) {
        animationRef.current = requestAnimationFrame(draw);
        return;
      }

      ctx.clearRect(0, 0, width, height);

      const nodes = nodesRef.current;
      const t = time * 0.001; // Convert to seconds

      // Very slow drift: 20-40 second loop
      const driftX = Math.sin(t * 0.05) * 8;
      const driftY = Math.cos(t * 0.035) * 6;

      // Update node positions with slow drift
      for (const node of nodes) {
        node.x = node.baseX + driftX + Math.sin(t * 0.03 + node.baseX * 0.005) * 3;
        node.y = node.baseY + driftY + Math.cos(t * 0.025 + node.baseY * 0.005) * 3;
      }

      // Draw connections — TUNING: lineOpacity controls connection visibility
      const lineOpacity = variant === "landing" ? 0.12 : 0.12;
      ctx.lineWidth = 0.7;

      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        for (const j of node.connections) {
          const other = nodes[j];
          const dx = node.x - other.x;
          const dy = node.y - other.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const maxDist = (variant === "landing" ? 120 : 140) * 1.6;

          // Fade out connections at distance
          const alpha = (1 - dist / maxDist) * lineOpacity * opacity;
          if (alpha <= 0) continue;

          ctx.beginPath();
          ctx.moveTo(node.x, node.y);
          ctx.lineTo(other.x, other.y);
          ctx.strokeStyle = `rgba(148, 163, 184, ${alpha})`; // blue-gray
          ctx.stroke();
        }
      }

      // Draw nodes — TUNING: nodeOpacity controls dot visibility
      const nodeOpacity = variant === "landing" ? 0.2 : 0.12;

      for (const node of nodes) {
        // Base node (subtle blue-gray dot)
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(148, 163, 184, ${nodeOpacity * opacity})`;
        ctx.fill();

        // Amber pulse on selected nodes
        if (node.hasPulse) {
          const pulse = (Math.sin(t * node.pulseSpeed * Math.PI * 2 + node.pulsePhase) + 1) * 0.5;
          // TUNING: pulseAlpha controls amber glow intensity
          const pulseAlpha = pulse * (variant === "landing" ? 0.5 : 0.3) * opacity;
          const pulseRadius = node.radius + pulse * 4;

          ctx.beginPath();
          ctx.arc(node.x, node.y, pulseRadius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(250, 204, 21, ${pulseAlpha})`; // #FACC15
          ctx.fill();
        }
      }

      animationRef.current = requestAnimationFrame(draw);
    }

    resize();
    animationRef.current = requestAnimationFrame(draw);

    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationRef.current);
    };
  }, [variant, opacity]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ filter: "blur(0.5px)" }}
    />
  );
}
