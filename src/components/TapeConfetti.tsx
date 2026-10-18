"use client";

import { useEffect, useRef } from "react";

// Recortes de cinta: tiras finas con los colores de las rayas y algún trozo de cinta magnética.
const COLORS = ["#F2B632", "#E5482E", "#6FB7E0", "#F4EEDF", "#5B3A1E"];
const DURATION_MS = 5200;

interface Piece {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  wobble: number;
  color: string;
}

/** Lluvia de recortes de cinta sobre toda la pantalla. No se muestra con movimiento reducido. */
export function TapeConfetti() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
    };
    resize();
    window.addEventListener("resize", resize);

    const W = () => window.innerWidth;
    const count = Math.round(Math.min(220, W() / 6));
    const pieces: Piece[] = Array.from({ length: count }, () => ({
      x: Math.random() * W(),
      y: -20 - Math.random() * window.innerHeight * 0.6,
      w: 6 + Math.random() * 6,
      h: 18 + Math.random() * 26,
      vx: (Math.random() - 0.5) * 1.2,
      vy: 2.2 + Math.random() * 3,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.2,
      wobble: Math.random() * Math.PI * 2,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    }));

    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = now - start;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W(), window.innerHeight);
      // Se desvanece en el último segundo.
      ctx.globalAlpha = t > DURATION_MS - 1000 ? Math.max(0, (DURATION_MS - t) / 1000) : 1;
      for (const p of pieces) {
        p.wobble += 0.08;
        p.x += p.vx + Math.sin(p.wobble) * 0.8;
        p.y += p.vy;
        p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        // El giro sobre su eje se simula estrechando la tira.
        ctx.scale(Math.cos(p.wobble), 1);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (t < DURATION_MS) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, W(), window.innerHeight);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh", pointerEvents: "none", zIndex: 50 }}
    />
  );
}
