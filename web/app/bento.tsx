"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import Bars from "./bars";
import { SliceBars, StackBars, WindowBars } from "./charts";

type Paper = { title: string; html: string; toc: { id: string; level: number; text: string }[]; words: number } | null;
type OutFile = { path: string; lang: string; text: string };
export type Site = {
  generatedAt: string;
  papers: { lite: Paper; white: Paper };
  outputs: { code: OutFile[]; results: OutFile[]; proofs: OutFile[]; verify: OutFile[]; prereg: OutFile[] };
  series: {
    arbPerWindow: number[]; solverPerWindow: number[];
    spike: { index: number; sharePct: number }; solverTop: { index: number; sharePct: number };
    stack: { label: string; app: number; solver: number; protocol: number }[];
    treasury: { label: string; bps: number; ci: number[]; quotes: number }[];
  };
  numbers: {
    rhea: { baselinePerDay: number; baselineCI: number[]; baselineBps: number; meanPerDay: number; spikeSharePct: number; top3Pct: number; top3ExSpikePct: number; backrunPct: number; sandwichPatterns: number; issuancePct: number };
    intents: { appFeeBps: number; totalBps: number; solverBps: number; protocolBps: number; under100Bps: number; coveragePct: number; hubTxPct: number };
    treasury: { allBps: number; allCI: number[]; otherBps: number; otherCI: number[]; sameBps: number; sameCI: number[]; quotes: number; medianQuoteBps: number; costPerDay: number; robustBps: number } | null;
    validators: { feeSharePct: number; chunkT1p: number; chunkT2bp: number; winnersTested: number; fullWeek: boolean };
    verify: { passed: number | null; failed: number };
    prereg: { sha256: string; hashedAt: string; stampedAt: string };
    range: { from: number; to: number; dates: string; windows: number };
  };
};

const usd = (v: number) => "$" + Math.round(v).toLocaleString("en-US");
const f1 = (v: number) => (Math.round(v * 10) / 10).toString();

type Tab = "lite" | "white" | "code" | "summary";
type OutKind = keyof Site["outputs"];
type View = { tab: Tab; group: OutKind; file: number; slide: number };
const TAB_LABEL: Record<Tab, string> = { lite: "Litepaper", white: "Whitepaper", code: "Code", summary: "Summary" };
const GROUP_LABEL: Record<OutKind, string> = { code: "Code", results: "Results", proofs: "Lean proofs", verify: "Verify log", prereg: "Pre-registration" };

// ------------------------------------------------------------------ layout engine
// Every state places each tile on a grid: [col, row, colSpan, rowSpan], or null to hide it.
// Rects are computed here and tiles transition their box. Only the state picks a layout; content never does.
type TileId = "brand" | "big" | "faq" | "hero" | "sum" | "val" | "proof" | "check" | "out" | "index" | "tabs";
type Place = [number, number, number, number] | null;
type Layout = { cols: number[]; rows: number[]; tiles: Record<TileId, Place> };
const TILES: TileId[] = ["brand", "big", "faq", "hero", "sum", "val", "proof", "check", "out", "index", "tabs"];
const HOME: Layout = {
  cols: [1, 1, 1, 1, 1.05], rows: [0.8, 1, 0.85, 0.9, 1.2],
  tiles: { brand: [0, 0, 1, 1], big: [0, 1, 1, 2], faq: [0, 3, 1, 2], hero: [1, 0, 3, 4], sum: [4, 0, 1, 2], val: [4, 2, 1, 2], proof: [1, 4, 1, 1], check: [2, 4, 1, 1], out: [3, 4, 2, 1], index: null, tabs: null },
};
const BOOT: Layout = { ...HOME, tiles: { brand: null, big: null, faq: null, hero: [1, 0, 3, 4], sum: null, val: null, proof: null, check: null, out: null, index: null, tabs: null } };
// the reading layout from the mock: brand + index on the left, tab bar + content on the right
const READ = (H: number, gap: number): Layout => {
  const bar = 56, brand = 150;
  return {
    cols: [1.15, 1, 1, 1, 1], rows: [bar, brand - bar - gap, Math.max(1, H - brand - gap)],
    tiles: { brand: [0, 0, 1, 2], index: [0, 2, 1, 1], tabs: [1, 0, 4, 1], hero: [1, 1, 4, 2], big: null, faq: null, sum: null, val: null, proof: null, check: null, out: null },
  };
};
type Rect = { x: number; y: number; w: number; h: number };
function tracks(fr: number[], total: number, gap: number) {
  const live = fr.filter(v => v > 0).length;
  const avail = Math.max(0, total - gap * Math.max(0, live - 1));
  const sum = fr.reduce((a, b) => a + b, 0) || 1;
  const size = fr.map(v => (v / sum) * avail);
  const pos: number[] = [];
  let p = 0;
  for (const s of size) { pos.push(p); p += s + (s > 0 ? gap : 0); }
  return { size, pos };
}
function compute(layout: Layout, W: number, H: number, gap: number): Record<TileId, Rect | null> {
  const c = tracks(layout.cols, W, gap), r = tracks(layout.rows, H, gap);
  const span = (tr: { size: number[] }, a: number, k: number) => {
    const sizes = tr.size.slice(a, a + k);
    return sizes.reduce((s, v) => s + v, 0) + gap * Math.max(0, sizes.filter(v => v > 0).length - 1);
  };
  const out = {} as Record<TileId, Rect | null>;
  for (const id of TILES) {
    const pl = layout.tiles[id];
    out[id] = pl ? { x: c.pos[pl[0]], y: r.pos[pl[1]], w: span(c, pl[0], pl[2]), h: span(r, pl[1], pl[3]) } : null;
  }
  return out;
}
const MOBILE_H: Partial<Record<TileId, number>> = { brand: 150, big: 210, val: 170, sum: 330, faq: 330, out: 300, proof: 180, check: 230 };
const MOBILE_ORDER: TileId[] = ["brand", "hero", "big", "val", "sum", "faq", "out", "proof", "check"];

const subscribeTheme = (cb: () => void) => { addEventListener("yuki-theme", cb); return () => removeEventListener("yuki-theme", cb); };

function CodeView({ file }: { file: OutFile }) {
  const lines = file.text.replace(/\n$/, "").split("\n");
  const comment = file.lang === "lean" ? /^(\s*)(--.*|\/-!?.*|-\/.*)$/ : file.lang === "js" ? /^(\s*)(\/\/.*)$/ : null;
  return (
    <pre className="code">
      {lines.map((l, i) => {
        const m = comment ? l.match(comment) : null;
        return (
          <div key={i} className="ln">
            <span className="no">{i + 1}</span>
            {m ? <span>{m[1]}<span className="cm">{m[2]}</span></span> : <span>{l || " "}</span>}
          </div>
        );
      })}
    </pre>
  );
}

type Slide = { id: string; short: string; kicker: string; title: string; body: ReactNode };

export default function Bento({ site }: { site: Site }) {
  const n = site.numbers, t = n.treasury, o = site.outputs, se = site.series;
  const [state, setState] = useState<"boot" | "home" | "read">("boot");
  const [view, setView] = useState<View>({ tab: "lite", group: "code", file: 0, slide: 0 });
  const [stat, setStat] = useState(0);
  const [size, setSize] = useState({ W: 0, H: 0, vh: 0 });
  const light = useSyncExternalStore(subscribeTheme, () => document.documentElement.dataset.theme === "light", () => false);
  const frameRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const mobile = size.W > 0 && size.W < 860;
  const reading = state === "read";

  const toggleTheme = () => {
    const next = !light;
    if (next) document.documentElement.dataset.theme = "light"; else delete document.documentElement.dataset.theme;
    try { localStorage.setItem("yuki-theme", next ? "light" : "dark"); } catch {}
    dispatchEvent(new Event("yuki-theme"));
  };

  const stats: { value: ReactNode; caption: string }[] = [
    { value: <>{usd(n.rhea.baselinePerDay)}<span className="unit">/day</span></>, caption: "On-chain arbitrage on Rhea at baseline. Small, and taken by a few bots." },
    { value: <>{f1(n.intents.totalBps)}<span className="unit">bps</span></>, caption: `What users pay on public Intents swaps; ${f1(n.intents.appFeeBps)} bps of it is app fees.` },
    ...(t ? [{ value: <>{usd(t.costPerDay / 1000)}k<span className="unit">/day</span></>, caption: `All-in user cost on the confidential route: ${f1(t.allBps)} bps over ${t.quotes} priced quotes.` }] : []),
  ];

  const Nums = ({ items }: { items: [string, string][] }) => (
    <div className="nums">{items.map(([v, l]) => <div className="num" key={l}><b>{v}</b><span>{l}</span></div>)}</div>
  );
  const finding = (id: string, short: string, kicker: string, title: string, lead: string, nums: [string, string][], body: string[]): Slide => ({
    id, short, kicker, title, body: (<><p className="lead">{lead}</p><Nums items={nums} />{body.map((p, i) => <p key={i}>{p}</p>)}</>),
  });
  const thesis = (
    <ol className="sum-list">
      <li><b>Order isn’t sold.</b> No priority fee and no tips; fees are burnt and validators are paid from issuance.</li>
      <li><b>Arbitrage is small.</b> About {usd(n.rhea.baselinePerDay)} a day on Rhea, half of it to three bots.</li>
      <li><b>Public swaps cost {f1(n.intents.totalBps)} bps,</b> {f1(n.intents.appFeeBps)} of it app fees in the user’s own intent.</li>
      {t && <li><b>The confidential route costs about {f1(t.allBps)} bps</b> all-in, {usd(t.costPerDay)} a day, and the chain can’t say who gets it.</li>}
      <li><b>So value goes to distribution,</b> not to order. Selling order would capture little.</li>
    </ol>
  );
  const slides: Slide[] = [
    { id: "overview", short: "The thesis", kicker: "Summary", title: "The thesis in five lines", body: <div className="slide-sum">{thesis}</div> },
    finding("arb", "Arbitrage", "Rhea · on-chain AMM", "A few bots, competing on speed",
      `Cyclic arbitrage on Rhea earns about ${usd(n.rhea.baselinePerDay)} a day outside one six-minute router-driven event, which alone held ${f1(n.rhea.spikeSharePct)} % of the week's profit.`,
      [[usd(n.rhea.baselinePerDay) + "/day", `baseline (95 % CI ${usd(n.rhea.baselineCI[0])}–${usd(n.rhea.baselineCI[1])})`], [f1(n.rhea.top3Pct) + " %", "taken by the top three senders"], [f1(n.rhea.backrunPct) + " %", "of profit from back-runs"], ["0", `confirmed sandwiches of ${n.rhea.sandwichPatterns} patterns`]],
      ["Every swap hop is rebuilt from receipt logs, so contract-triggered and multi-hop swaps count. Bots respond to price gaps with speed and retries; there is no way to pay for position."]),
    { id: "chart-arb", short: "Chart: arbitrage per window", kicker: "Chart · Rhea", title: "Arbitrage profit per sampled window", body: (<><WindowBars values={se.arbPerWindow} mark={{ index: se.spike.index, text: `one router event: ${se.spike.sharePct} % of the week` }} label="Rhea cyclic arbitrage profit per sampled 600-block window" /><p className="chart-note">Each bar is one of 168 evenly spaced windows of 600 blocks; sample values, not scaled. The median window earns cents.</p></>) },
    finding("validators", "Validators", "Validators", "None of the fee stream",
      "Gas is burnt, the developer share of burnt gas is zero, and validators are paid from issuance. The chunk headers we checked report a zero validator reward.",
      [["0 %", "of fees to validators"], [n.validators.chunkT1p.toFixed(2), "p, winners vs producer schedule"], [n.validators.chunkT2bp.toFixed(2), "p, winners vs failed attempts"], [String(n.validators.winnersTested), n.validators.fullWeek ? "winning back-runs tested (full week)" : "winning back-runs tested (last 23 windows)"]],
      ["If order were being sold off-protocol, winning back-runs should cluster in the chunks of the selling producers. They do not, at the resolution of this test. A null result is not proof that no order is sold."]),
    finding("intents", "Public swaps", "NEAR Intents · public settlement", "Mostly app fees, not solver spread",
      `On swaps that settle in public, users pay ${f1(n.intents.totalBps)} bps against mid. Integrator fees carried in the user's own signed intent are three quarters of it.`,
      [[f1(n.intents.appFeeBps) + " bps", "integrator / app fees"], [f1(n.intents.solverBps) + " bps", "solver spread (CI includes 0)"], [n.intents.protocolBps.toFixed(2) + " bps", "protocol fee"], [Math.round(n.intents.under100Bps) + " bps", "all-in under $100"]],
      [`This public slice is only about ${f1(n.intents.coveragePct)} % of the volume an aggregator reports for NEAR Intents. The rest is mostly routed through a confidential bridge.`]),
    { id: "chart-stack", short: "Chart: cost by trade size", kicker: "Chart · NEAR Intents", title: "What users pay, by trade size", body: (<><StackBars rows={se.stack} /><p className="chart-note">Basis points of priced user volume against the one-minute mid. Small trades pay the most, almost all of it in app fees.</p></>) },
    { id: "chart-solver", short: "Chart: solver capture", kicker: "Chart · NEAR Intents", title: "Solver capture per sampled window", body: (<><WindowBars values={se.solverPerWindow} mark={{ index: se.solverTop.index, text: `one swap: ${se.solverTop.sharePct} % of solver capture` }} label="Intents solver capture per sampled window" /><p className="chart-note">Solver spread is fragile: one large swap carries most of the week, and the interval includes zero.</p></>) },
    ...(t ? [
      finding("treasury", "Confidential route", "NEAR Intents · confidential settlement", "A fee layer we can price but not split",
        `The account in ${f1(n.intents.hubTxPct)} % of Intents transactions is the Treasury of a private bridge: 1Click shields the deposit, the trade settles out of public view, and the output is released back. Shield and release are public, so the all-in cost is measurable.`,
        [[f1(t.allBps) + " bps", `all priced quotes (CI ${f1(t.allCI[0])}–${f1(t.allCI[1])})`], [f1(t.otherBps) + " bps", "non-stablecoin pairs"], [f1(t.sameBps) + " bps", "same asset across chains, price-free"], [usd(t.costPerDay) + "/day", "paid by users, scaled"]],
        [`The typical quote pays about ${Math.round(t.medianQuoteBps)} bps; large stablecoin and bitcoin quotes pull the value-weighted figure down. Pricing more tokens moves it to ${f1(t.robustBps)} bps. Who receives it, and how much is solver spread, happens on the private ledger.`]),
      { id: "chart-treasury", short: "Chart: confidential route", kicker: "Chart · confidential settlement", title: "All-in cost by slice, with 95 % intervals", body: (<><SliceBars rows={se.treasury} /><p className="chart-note">Value-weighted basis points of the value shielded; the label gives the number of priced quotes. Same-asset routes need no prices.</p></>) },
    ] : []),
    finding("order", "Policy", "Policy", "Selling order would capture very little today",
      `On-chain arbitrage is about ${n.rhea.issuancePct.toFixed(2)} % of the chain's maximum issuance. Even at a hundred times its size it stays under ${Math.ceil(n.rhea.issuancePct * 100)} %.`,
      [[n.rhea.issuancePct.toFixed(2) + " %", "arbitrage / max issuance"], [usd(n.rhea.meanPerDay) + "/day", "registered estimator incl. the spike"]],
      ["A priority fee was proposed (NEP-541) and closed. The money in trading on NEAR sits in the distribution layer that routes users' orders, not in transaction order."]),
    finding("trust", "Verification", "Verification", "Recomputed, proved, timestamped",
      `Every headline number is recomputed offline from stored, hashed data by a script with ${n.verify.passed ?? "all"} pass/fail checks. The algebra behind the claims is machine-checked in Lean 4.`,
      [[`${n.verify.passed ?? "—"}/${(n.verify.passed ?? 0) + n.verify.failed}`, "offline checks passing"], ["Lean 4", "proofs, no sorry"], ["v1–v4", "pre-registered hypotheses"], ["18:06", "UTC OpenTimestamps stamp"]],
      [`The pre-registration's SHA-256 (${n.prereg.sha256.slice(0, 12)}…) was taken ${n.prereg.hashedAt} and stamped publicly at ${n.prereg.stampedAt}. Departures from it are disclosed. All data come from read-only public APIs over blocks ${n.range.from.toLocaleString("en-US")}–${n.range.to.toLocaleString("en-US")}.`]),
  ];
  const slideIdx = (id: string) => Math.max(0, slides.findIndex(s => s.id === id));
  const groups = (Object.keys(o) as OutKind[]).filter(k => o[k].length);

  const hashOf = (v: View) => v.tab === "lite" ? "litepaper" : v.tab === "white" ? "whitepaper" : v.tab === "code" ? `code/${v.group}` : `summary/${slides[v.slide]?.id ?? "overview"}`;
  const open = (patch: Partial<View>) => {
    const v = { ...view, ...patch };
    setView(v);
    setState("read");
    history.replaceState(null, "", "#" + hashOf(v));
  };
  const close = useCallback(() => {
    setState("home");
    history.replaceState(null, "", location.pathname);
  }, []);

  // measure the frame (content box)
  useLayoutEffect(() => {
    const el = frameRef.current!;
    const measure = () => {
      const cs = getComputedStyle(el);
      const px = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight), py = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      setSize({ W: el.clientWidth - px, H: el.clientHeight - py, vh: el.clientHeight });
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);

  // deep links: #litepaper, #whitepaper, #code/<group>, #summary/<slide>; old finding ids map to their slide
  useEffect(() => {
    const parse = (): Partial<View> | null => {
      const [a, b] = location.hash.slice(1).split("/");
      if (a === "litepaper") return { tab: "lite" };
      if (a === "whitepaper") return { tab: "white" };
      if (a === "code") return { tab: "code", group: (groups.includes(b as OutKind) ? b : "code") as OutKind, file: 0 };
      if (groups.includes(a as OutKind)) return { tab: "code", group: a as OutKind, file: 0 };
      if (a === "summary" || a === "charts") return { tab: "summary", slide: b ? slideIdx(b) : a === "charts" ? slideIdx("chart-arb") : 0 };
      if (slides.some(s => s.id === a)) return { tab: "summary", slide: slideIdx(a) };
      return null;
    };
    const apply = () => {
      const p = parse();
      if (p) { setView(v => ({ ...v, ...p })); setState("read"); } else setState("home");
    };
    const id = setTimeout(apply, 120);
    addEventListener("hashchange", apply);
    return () => { clearTimeout(id); removeEventListener("hashchange", apply); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const slideIds = slides.map(s => s.id).join(",");
  useEffect(() => {
    const ids = slideIds.split(",");
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (state === "read" && view.tab === "summary" && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
        const next = Math.min(ids.length - 1, Math.max(0, view.slide + (e.key === "ArrowRight" ? 1 : -1)));
        setView(v => ({ ...v, slide: next }));
        history.replaceState(null, "", "#summary/" + ids[next]);
      }
    };
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  }, [close, state, view.tab, view.slide, slideIds]);

  // every new document, file or slide starts at its top
  useEffect(() => { scrollRef.current?.scrollTo({ top: 0 }); }, [view.tab, view.group, view.file, view.slide]);

  // the stat carousel only changes its own text, never the layout
  useEffect(() => {
    if (state !== "home") return;
    const id = setInterval(() => setStat(s => (s + 1) % stats.length), 7000);
    return () => clearInterval(id);
  }, [state, stats.length]);

  // ------------------------------------------------------------ rects for this state
  const gap = mobile ? 10 : 14;
  let rects = {} as Record<TileId, Rect | null>;
  let innerH = size.H;
  const home = !mobile && size.W ? compute(HOME, size.W, size.H, gap) : null;
  const read = !mobile && size.W ? compute(READ(size.H, gap), size.W, size.H, gap) : null;
  if (mobile) {
    let y = 0;
    for (const id of MOBILE_ORDER) {
      const h = id === "hero" ? Math.round(size.vh * 0.62) : MOBILE_H[id] ?? 200;
      rects[id] = { x: 0, y, w: size.W, h };
      y += h + gap;
    }
    innerH = y - gap;
  } else if (size.W) {
    rects = compute(state === "read" ? READ(size.H, gap) : state === "boot" ? BOOT : HOME, size.W, size.H, gap);
  }
  // a hidden tile waits, faded, where it lives in the other layout: home tiles fade in place, reader tiles grow from theirs
  const tileStyle = (id: TileId): React.CSSProperties => {
    if (!size.W) return { visibility: "hidden" };
    if (mobile && reading && (id === "tabs" || id === "hero")) {
      return id === "tabs"
        ? { position: "fixed", left: gap, top: gap, width: `calc(100vw - ${2 * gap}px)`, height: 52, zIndex: 51 }
        : { position: "fixed", left: gap, top: gap + 52 + gap, width: `calc(100vw - ${2 * gap}px)`, height: `calc(100dvh - ${3 * gap + 52}px)`, zIndex: 50 };
    }
    const r = rects[id];
    const shown = r ?? home?.[id] ?? read?.[id] ?? { x: size.W / 2, y: size.H / 2, w: 0, h: 0 };
    return { left: shown.x, top: shown.y, width: shown.w, height: shown.h, opacity: r ? 1 : 0, transform: r ? "none" : "scale(0.96)", pointerEvents: r ? undefined : "none" };
  };

  const paper = view.tab === "lite" || view.tab === "white" ? site.papers[view.tab] : null;
  const files = o[view.group] ?? [];
  const file = files[Math.min(view.file, Math.max(0, files.length - 1))];
  const slide = slides[Math.min(view.slide, slides.length - 1)];

  const outputs: { label: string; meta: string; go: Partial<View>; on: boolean }[] = [
    { label: "Litepaper", meta: `${site.papers.lite?.words.toLocaleString("en-US") ?? 0} words`, go: { tab: "lite" }, on: view.tab === "lite" },
    { label: "Whitepaper", meta: `${site.papers.white?.words.toLocaleString("en-US") ?? 0} words`, go: { tab: "white" }, on: view.tab === "white" },
    { label: "Summary", meta: `${slides.length} slides`, go: { tab: "summary", slide: 0 }, on: view.tab === "summary" },
    ...groups.map(g => ({ label: GROUP_LABEL[g], meta: g === "verify" ? `${n.verify.passed}/${(n.verify.passed ?? 0) + n.verify.failed} pass` : g === "prereg" ? `sha ${n.prereg.sha256.slice(0, 8)}…` : `${o[g].length} file${o[g].length > 1 ? "s" : ""}`, go: { tab: "code" as Tab, group: g, file: 0 }, on: view.tab === "code" && view.group === g })),
  ];

  return (
    <main className={`frame${mobile ? " mobile" : ""}${mobile && reading ? " locked" : ""}`} ref={frameRef}>
      <div className="stage" style={{ height: mobile ? innerH : "100%" }} data-state={state}>
        {/* brand + tagline (stays in the reader) */}
        <section className="tile" style={tileStyle("brand")}>
          <div className="pad">
            <div className="brand-top">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="wordmark wm-dark" src="/yuki-wordmark-ice.svg" alt="Yuki" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="wordmark wm-light" src="/yuki-wordmark-ink.svg" alt="" />
              <span className="brand-tools">
                <span className="chip">NEAR ’26</span>
                <button className="theme-toggle" onClick={toggleTheme} aria-label={light ? "Switch to dark mode" : "Switch to light mode"} title={light ? "Dark mode" : "Light mode"}>
                  {light ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
                  )}
                </button>
              </span>
            </div>
            <p className="brand-q">On a chain that does not sell transaction order, where does trading value go, and who pays for it?</p>
          </div>
        </section>

        {/* reader: tab bar */}
        <section className="tile tabs-tile" style={tileStyle("tabs")} aria-hidden={!reading}>
          <div className="seg" role="tablist" aria-label="Documents">
            {(Object.keys(TAB_LABEL) as Tab[]).map(k => (
              <button key={k} role="tab" aria-selected={view.tab === k} onClick={() => open({ tab: k })}>{TAB_LABEL[k]}</button>
            ))}
          </div>
          <button className="close" onClick={close} aria-label="Close reader">Close <span aria-hidden>×</span></button>
        </section>

        {/* reader: index */}
        <section className="tile" style={tileStyle("index")} aria-hidden={!reading}>
          <div className="pad index">
            <span className="label">{view.tab === "code" ? "Files" : view.tab === "summary" ? "Slides" : "Contents"}</span>
            <nav className="index-list">
              {paper && paper.toc.map(h => (
                <a key={h.id} href={"#" + h.id} className={"l" + h.level} onClick={e => { e.preventDefault(); scrollRef.current?.querySelector("#" + CSS.escape(h.id))?.scrollIntoView({ behavior: "smooth" }); }}>{h.text}</a>
              ))}
              {view.tab === "code" && groups.map(g => (
                <div key={g} className="group">
                  <button className={`group-head${view.group === g ? " on" : ""}`} onClick={() => open({ group: g, file: 0 })}>{GROUP_LABEL[g]} <span>{o[g].length}</span></button>
                  {view.group === g && o[g].map((f, i) => (
                    <a key={f.path} href="#" className={`file${i === view.file ? " on" : ""}`} onClick={e => { e.preventDefault(); setView(v => ({ ...v, file: i })); }}>{f.path}</a>
                  ))}
                </div>
              ))}
              {view.tab === "summary" && slides.map((s, i) => (
                <a key={s.id} href={"#summary/" + s.id} className={`slide-link${i === view.slide ? " on" : ""}`} onClick={e => { e.preventDefault(); open({ slide: i }); }}><span>{String(i + 1).padStart(2, "0")}</span>{s.short}</a>
              ))}
            </nav>
          </div>
        </section>

        {/* stat carousel: content only */}
        <section className="tile" style={tileStyle("big")}>
          <div className="pad">
            <span className="label">This week on NEAR</span>
            <div key={stat} className="swap-in stat-slot">
              <div className="stat-big">{stats[stat].value}</div>
              <p className="cap">{stats[stat].caption}</p>
            </div>
          </div>
          <div className="dots">
            {stats.map((_, i) => <button key={i} aria-label={`Show stat ${i + 1}`} aria-current={i === stat} onClick={() => setStat(i)} />)}
          </div>
        </section>

        {/* findings → summary slides */}
        <section className="tile" style={tileStyle("faq")}>
          <div className="pad">
            <span className="label">Findings</span>
            <ul className="faq-list">
              {[["arb", "Who captures arbitrage?"], ["validators", "Do validators get any?"], ["intents", "What do swaps cost users?"], ["treasury", "And the confidential route?"], ["order", "Would selling order help?"], ["trust", "How do we know it’s right?"]].filter(([id]) => slides.some(s => s.id === id)).map(([id, q]) => (
                <li key={id}><button onClick={() => open({ tab: "summary", slide: slideIdx(id) })}>{q}</button></li>
              ))}
            </ul>
          </div>
        </section>

        {/* hero ↔ content */}
        <section className={`tile hero${reading ? " reading" : ""}`} style={tileStyle("hero")}>
          <div className="layer" data-on={!reading}>
            <Bars series={se.arbPerWindow} running={!reading && state !== "boot"} />
            <div className="hero-title">
              <span className="hero-kicker">Yuki · thesis track · {n.range.dates}</span>
              <h1>Order isn’t for sale.<br />So who gets paid?</h1>
              <p>Each rod is a slice of the week; its glowing capsule is that slice’s on-chain arbitrage profit. The longest is a single six-minute router event.</p>
            </div>
          </div>
          <div className="layer content" data-on={reading} aria-hidden={!reading}>
            {paper ? (
              <div className="scroll" ref={scrollRef}>
                <article className="paper">
                  <div className="paper-kind">{view.tab === "lite" ? "Litepaper" : "Whitepaper"}</div>
                  <h1 className="paper-title">{paper.title}</h1>
                  <div dangerouslySetInnerHTML={{ __html: paper.html }} />
                </article>
              </div>
            ) : view.tab === "code" && file ? (
              <div className="scroll" ref={scrollRef}>
                <div className="file-head">{file.path}<span>{file.text.split("\n").length.toLocaleString("en-US")} lines</span></div>
                <CodeView file={file} />
              </div>
            ) : view.tab === "summary" && slide ? (
              <div className="deck">
                <div className="scroll slide-scroll" ref={scrollRef}>
                  <article className="slide swap-in" key={slide.id}>
                    <div className="kicker">{slide.kicker}</div>
                    <h2>{slide.title}</h2>
                    {slide.body}
                  </article>
                </div>
                <div className="deck-bar">
                  <button className="pill ghost" disabled={view.slide === 0} onClick={() => open({ slide: view.slide - 1 })}>← Previous</button>
                  <span className="deck-count">{view.slide + 1} / {slides.length}</span>
                  <button className="pill" disabled={view.slide === slides.length - 1} onClick={() => open({ slide: view.slide + 1 })}>Next →</button>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        {/* thesis summary */}
        <section className="tile strong" style={tileStyle("sum")}>
          <button className="pad as-button" onClick={() => open({ tab: "summary", slide: 0 })}>
            <span className="label">The thesis in five lines</span>
            {thesis}
          </button>
        </section>

        {/* validators + checks, one card */}
        <section className="tile accent-card" style={tileStyle("val")}>
          <div className="val">
            <button className="half" onClick={() => open({ tab: "summary", slide: slideIdx("validators") })}>
              <span className="label">To validators</span>
              <span className="big-num">0 %</span>
              <span className="cap">of the fee stream</span>
            </button>
            <button className="half" onClick={() => open({ tab: "code", group: "verify", file: 0 })}>
              <span className="label">Offline checks</span>
              <span className="big-num">{n.verify.passed ?? "—"}<span style={{ opacity: 0.45 }}>/{(n.verify.passed ?? 0) + n.verify.failed}</span></span>
              <span className="cap">recomputed from hashed data</span>
            </button>
          </div>
        </section>

        {/* bottom row */}
        <section className="tile soft" style={tileStyle("proof")}>
          <div className="pad">
            <span className="label">★ A traced quote</span>
            <span className="big-num" style={{ marginTop: "auto", fontSize: "min(20cqw, 30cqh)" }}>21.7<span style={{ fontSize: "0.4em", marginLeft: 4 }}>bps</span></span>
            <p className="cap" style={{ marginTop: 8 }}>$57k NBTC → USDT: shielded, released 9 s later, withdrawn.</p>
            <span className="cap">— account e464353c…, on-chain</span>
          </div>
        </section>
        <section className="tile" style={tileStyle("check")}>
          <div className="pad">
            <ul className="checks">
              <li>Pre-registered, v1–v4</li>
              <li>Departures disclosed</li>
              <li>{n.verify.passed} offline checks</li>
              <li>Lean 4 proofs</li>
              <li>OpenTimestamps stamp</li>
              <li>Read-only public data</li>
            </ul>
          </div>
        </section>

        {/* papers & outputs: the one section for documents and artefacts */}
        <section className="tile" style={tileStyle("out")}>
          <div className="pad">
            <span className="label">Papers &amp; outputs</span>
            <div className="outs">
              {outputs.map(x => (
                <button key={x.label} className={`out${reading && x.on ? " on" : ""}`} onClick={() => open(x.go)}>
                  <span className="out-l">{x.label}</span>
                  <span className="out-m">{x.meta}</span>
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
