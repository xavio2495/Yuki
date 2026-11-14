"use client";

import { useEffect, useRef } from "react";

// Vertical light rods, each carrying a tapered capsule that drifts along it. One rod per group of
// sampled block windows; capsule length is that group's on-chain arbitrage profit (log-scaled),
// so the single router-driven spike shows as the longest capsule. The pointer pushes capsules away.
export default function Bars({ series, running }: { series: number[]; running: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const runRef = useRef(running);
  useEffect(() => { runRef.current = running; }, [running]);

  useEffect(() => {
    const cv = ref.current!;
    const ctx = cv.getContext("2d")!;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0, h = 0, dpr = 1, raf = 0;
    const t0 = performance.now();
    const pointer = { x: -1e4, y: -1e4, active: false };
    // palette from the theme (3 colours): accent for the rods, background for the floor fade
    const rgb = (v: string) => { const h = v.trim().replace("#", ""); const n = parseInt(h.length === 3 ? h.replace(/./g, c => c + c) : h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
    const pal = { a: [111, 139, 255], bg: [5, 7, 10], fg: [185, 216, 224] };
    const readPalette = () => { const cs = getComputedStyle(document.documentElement); pal.a = rgb(cs.getPropertyValue("--accent") || "#6f8bff"); pal.bg = rgb(cs.getPropertyValue("--bg") || "#05070a"); pal.fg = rgb(cs.getPropertyValue("--fg") || "#b9d8e0"); if (reduce) draw(0); };
    const c = (k: "a" | "bg" | "fg", alpha: number) => `rgba(${pal[k][0]},${pal[k][1]},${pal[k][2]},${alpha})`;

    // group windows into rods
    const ROD_TARGET = 28;
    const per = Math.max(1, Math.round(series.length / ROD_TARGET));
    const groups: number[] = [];
    for (let i = 0; i < series.length; i += per) groups.push(series.slice(i, i + per).reduce((a, b) => a + b, 0));
    const maxLog = Math.log1p(Math.max(...groups));
    const rods = groups.map((v, i) => {
      const frac = maxLog ? Math.log1p(v) / maxLog : 0;
      // deterministic pseudo-random per rod
      const r = (k: number) => { const x = Math.sin((i + 1) * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
      return { frac, base: 0.18 + r(1) * 0.42, amp: 0.05 + r(2) * 0.12, speed: 0.08 + r(3) * 0.12, phase: r(4) * Math.PI * 2, push: 0, width: 0.55 + r(5) * 0.45, value: v };
    });

    const resize = () => {
      const b = cv.getBoundingClientRect();
      dpr = Math.min(2, devicePixelRatio || 1);
      w = b.width; h = b.height;
      cv.width = Math.max(1, Math.round(w * dpr)); cv.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(cv);
    resize();

    const capsule = (x: number, y0: number, y1: number, half: number) => {
      // a spindle: thin at both ends, full width in the middle third
      const len = y1 - y0, tip = Math.min(len * 0.22, half * 5);
      ctx.beginPath();
      ctx.moveTo(x, y0);
      ctx.bezierCurveTo(x + half, y0 + tip * 0.6, x + half, y0 + tip, x + half, y0 + tip);
      ctx.lineTo(x + half, y1 - tip);
      ctx.bezierCurveTo(x + half, y1 - tip * 0.6, x + half * 0.2, y1, x, y1 + 2);
      ctx.bezierCurveTo(x - half * 0.2, y1, x - half, y1 - tip * 0.6, x - half, y1 - tip);
      ctx.lineTo(x - half, y0 + tip);
      ctx.bezierCurveTo(x - half, y0 + tip, x - half, y0 + tip * 0.6, x, y0);
      ctx.closePath();
    };

    const draw = (now: number) => {
      const t = reduce ? 0 : (now - t0) / 1000;
      ctx.clearRect(0, 0, w, h);
      const n = rods.length, gap = w / (n + 1);
      const rodW = Math.max(1.4, gap * 0.07), capHalf = Math.max(3, gap * 0.2);
      for (let i = 0; i < n; i++) {
        const r = rods[i];
        const x = gap * (i + 1);
        // pointer push, eased
        const dx = x - pointer.x, near = pointer.active ? Math.exp(-(dx * dx) / (2 * (gap * 1.6) ** 2)) : 0;
        r.push += ((pointer.active ? (pointer.y / h < r.base + 0.2 ? 0.18 : -0.18) * near : 0) - r.push) * 0.08;
        const len = h * (0.1 + 0.42 * r.frac);
        const center = h * (r.base + r.amp * Math.sin(t * r.speed * Math.PI * 2 + r.phase) + r.push) + len / 2;
        const y0 = Math.max(-len * 0.4, center - len / 2), y1 = y0 + len;

        // rod: bright top fading to the floor
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, c("a", 0.95));
        g.addColorStop(0.55, c("a", 0.45));
        g.addColorStop(1, c("a", 0.05));
        ctx.fillStyle = g;
        ctx.fillRect(x - rodW / 2, 0, rodW, h);

        // capsule
        const cg = ctx.createLinearGradient(0, y0, 0, y1);
        cg.addColorStop(0, c("fg", 0.95));
        cg.addColorStop(0.3, c("a", 1));
        cg.addColorStop(1, c("a", 0.3));
        ctx.fillStyle = cg;
        ctx.shadowColor = c("a", 0.55);
        ctx.shadowBlur = 18 * r.frac + 4;
        capsule(x, y0, y1, capHalf * r.width * (0.7 + 0.5 * near));
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      // floor fade
      const f = ctx.createLinearGradient(0, h * 0.55, 0, h);
      f.addColorStop(0, c("bg", 0));
      f.addColorStop(1, c("bg", 0.9));
      ctx.fillStyle = f;
      ctx.fillRect(0, h * 0.55, w, h * 0.45);
    };

    const loop = (now: number) => {
      if (runRef.current && !document.hidden) draw(now);
      raf = requestAnimationFrame(loop);
    };
    readPalette();
    addEventListener("yuki-theme", readPalette);
    if (reduce) draw(0); else raf = requestAnimationFrame(loop);

    const move = (e: PointerEvent) => { const b = cv.getBoundingClientRect(); pointer.x = e.clientX - b.left; pointer.y = e.clientY - b.top; pointer.active = true; };
    const leave = () => { pointer.active = false; };
    cv.addEventListener("pointermove", move);
    cv.addEventListener("pointerleave", leave);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); removeEventListener("yuki-theme", readPalette); cv.removeEventListener("pointermove", move); cv.removeEventListener("pointerleave", leave); };
  }, [series]);

  return <canvas ref={ref} className="bars" aria-hidden="true" />;
}
