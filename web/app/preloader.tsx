"use client";

import { useEffect, useState } from "react";
import Bars from "./bars";

// Intro: the site's animated line background, full screen, which then lifts to reveal the page.
export default function Preloader({ series }: { series: number[] }) {
  const [phase, setPhase] = useState<"in" | "out" | "gone">("in");
  useEffect(() => {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t1 = setTimeout(() => setPhase("out"), reduce ? 0 : 1600);
    const t2 = setTimeout(() => setPhase("gone"), reduce ? 0 : 2400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  if (phase === "gone") return null;
  return (
    <div className={`preloader${phase === "out" ? " out" : ""}`} aria-hidden="true">
      <Bars series={series} running />
      <div className="pl-fade" />
    </div>
  );
}
