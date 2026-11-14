"use client";

import { useEffect, useState } from "react";

// Intro built from the site's line artwork: rods draw down, capsules slide into place, then the overlay lifts.
const RODS = 15;
export default function Preloader() {
  const [phase, setPhase] = useState<"in" | "out" | "gone">("in");
  useEffect(() => {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t1 = setTimeout(() => setPhase("out"), reduce ? 0 : 1500);
    const t2 = setTimeout(() => setPhase("gone"), reduce ? 0 : 2200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  if (phase === "gone") return null;
  return (
    <div className={`preloader${phase === "out" ? " out" : ""}`} aria-hidden="true">
      <div className="pl-rods">
        {Array.from({ length: RODS }, (_, i) => {
          const r = Math.abs(Math.sin((i + 1) * 12.9898) * 43758.5453) % 1;
          return (
            <span key={i} className="pl-rod" style={{ animationDelay: `${i * 45}ms` }}>
              <i style={{ top: `${18 + r * 52}%`, height: `${12 + ((r * 7) % 1) * 22}%`, animationDelay: `${300 + i * 45}ms` }} />
            </span>
          );
        })}
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="pl-mark wm-dark" src="/yuki-wordmark-ice.svg" alt="" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="pl-mark wm-light" src="/yuki-wordmark-ink.svg" alt="" />
    </div>
  );
}
