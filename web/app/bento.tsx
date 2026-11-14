"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import Bars from "./bars";

type Paper = { title: string; html: string; toc: { id: string; level: number; text: string }[]; words: number } | null;
type OutFile = { path: string; lang: string; text: string };
export type Site = {
  generatedAt: string;
  papers: { lite: Paper; white: Paper };
  outputs: { code: OutFile[]; results: OutFile[]; proofs: OutFile[]; verify: OutFile[]; prereg: OutFile[] };
  series: { arbPerWindow: number[] };
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

type OutKind = keyof Site["outputs"];
type View =
  | { kind: "paper"; which: "lite" | "white" }
  | { kind: "finding"; id: string }
  | { kind: "charts" }
  | { kind: "files"; set: OutKind; file: number };
type Finding = { id: string; tab: string; q: string; kicker: string; title: string; lead: string; nums: [string, string][]; body: string[]; src: string };

// ------------------------------------------------------------------ layout engine
// Every state places each tile on a 5 x 5 grid: [col, row, colSpan, rowSpan], or null to hide it.
// Rects are computed here and tiles transition their box, so they can move, resize and hide.
// Only the state (boot, home, read, focus) chooses a layout; tile content never does.
type TileId = "brand" | "big" | "faq" | "hero" | "sum" | "val" | "proof" | "check" | "out";
type Place = [number, number, number, number] | null;
type Layout = { cols: number[]; rows: number[]; tiles: Record<TileId, Place> };
const TILES: TileId[] = ["brand", "big", "faq", "hero", "sum", "val", "proof", "check", "out"];
const LAYOUTS: Record<"boot" | "home" | "read" | "focus", Layout> = {
  boot: { cols: [1, 1, 1, 1, 1], rows: [1, 1, 1, 1, 1], tiles: { brand: null, big: null, faq: null, hero: [0, 0, 5, 5], sum: null, val: null, proof: null, check: null, out: null } },
  home: {
    cols: [1, 1, 1, 1, 1.05], rows: [0.8, 1, 0.85, 0.9, 1.2],
    tiles: { brand: [0, 0, 1, 1], big: [0, 1, 1, 2], faq: [0, 3, 1, 2], hero: [1, 0, 3, 4], sum: [4, 0, 1, 2], val: [4, 2, 1, 2], proof: [1, 4, 1, 1], check: [2, 4, 1, 1], out: [3, 4, 2, 1] },
  },
  read: {
    cols: [0.8, 1.4, 1.4, 1.4, 0.66], rows: [0.45, 0.9, 1, 1, 0],
    tiles: { brand: [0, 0, 1, 1], big: [0, 1, 1, 1], faq: [0, 2, 1, 2], hero: [1, 0, 3, 4], sum: [4, 0, 1, 2], val: [4, 2, 1, 2], proof: null, check: null, out: null },
  },
  focus: {
    cols: [0.62, 1.6, 1.6, 1.6, 0], rows: [0.45, 1, 1, 1, 0],
    tiles: { brand: [0, 0, 1, 1], big: null, faq: null, hero: [1, 0, 3, 4], sum: null, val: null, proof: null, check: null, out: [0, 1, 1, 3] },
  },
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
// phones: one stacked column that scrolls inside the frame; reading takes the whole frame
const MOBILE_H: Record<TileId, number> = { brand: 150, hero: 0, big: 210, val: 170, sum: 330, faq: 330, out: 300, proof: 180, check: 230 };
const MOBILE_ORDER: TileId[] = ["brand", "hero", "big", "val", "sum", "faq", "out", "proof", "check"];

// the theme lives on <html data-theme>; components follow it through this event
const subscribeTheme = (cb: () => void) => { addEventListener("yuki-theme", cb); return () => removeEventListener("yuki-theme", cb); };

// ------------------------------------------------------------------ code viewer
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

export default function Bento({ site }: { site: Site }) {
  const n = site.numbers;
  const t = n.treasury;
  const o = site.outputs;
  const [state, setState] = useState<"boot" | "home" | "read" | "focus">("boot");
  const [view, setView] = useState<View>({ kind: "paper", which: "lite" });
  const [stat, setStat] = useState(0);
  const [size, setSize] = useState({ W: 0, H: 0, vh: 0 });
  const light = useSyncExternalStore(subscribeTheme, () => document.documentElement.dataset.theme === "light", () => false);
  const toggleTheme = () => {
    const next = !light;
    if (next) document.documentElement.dataset.theme = "light"; else delete document.documentElement.dataset.theme;
    try { localStorage.setItem("yuki-theme", next ? "light" : "dark"); } catch {}
    dispatchEvent(new Event("yuki-theme"));
  };
  const frameRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const mobile = size.W > 0 && size.W < 860;
  const reading = state === "read" || state === "focus";

  const stats: { value: ReactNode; caption: string }[] = [
    { value: <>{usd(n.rhea.baselinePerDay)}<span className="unit">/day</span></>, caption: "On-chain arbitrage on Rhea at baseline. Small, and taken by a few bots." },
    { value: <>{f1(n.intents.totalBps)}<span className="unit">bps</span></>, caption: `What users pay on public Intents swaps; ${f1(n.intents.appFeeBps)} bps of it is app fees.` },
    ...(t ? [{ value: <>{usd(t.costPerDay / 1000)}k<span className="unit">/day</span></>, caption: `All-in user cost on the confidential route: ${f1(t.allBps)} bps over ${t.quotes} priced quotes.` }] : []),
  ];

  const findings: Finding[] = [
    {
      id: "arb", tab: "Arbitrage", q: "Who captures arbitrage?", kicker: "Rhea · on-chain AMM", title: "A few bots, competing on speed",
      lead: `Cyclic arbitrage on Rhea earns about ${usd(n.rhea.baselinePerDay)} a day outside one six-minute router-driven event, which alone held ${f1(n.rhea.spikeSharePct)} % of the week's profit.`,
      nums: [[usd(n.rhea.baselinePerDay) + "/day", `baseline (95 % CI ${usd(n.rhea.baselineCI[0])}–${usd(n.rhea.baselineCI[1])})`], [f1(n.rhea.top3Pct) + " %", "taken by the top three senders"], [f1(n.rhea.backrunPct) + " %", "of profit from back-runs"], ["0", `confirmed sandwiches of ${n.rhea.sandwichPatterns} patterns`]],
      body: ["Every swap hop is rebuilt from receipt logs, so contract-triggered and multi-hop swaps count. Bots respond to price gaps with speed and retries; there is no way to pay for position."],
      src: "Whitepaper §3a",
    },
    {
      id: "validators", tab: "Validators", q: "Do validators get any?", kicker: "Validators", title: "None of the fee stream",
      lead: "Gas is burnt, the developer share of burnt gas is zero, and validators are paid from issuance. The chunk headers we checked report a zero validator reward.",
      nums: [["0 %", "of fees to validators"], [n.validators.chunkT1p.toFixed(2), "p, winners vs producer schedule"], [n.validators.chunkT2bp.toFixed(2), "p, winners vs failed attempts"], [String(n.validators.winnersTested), n.validators.fullWeek ? "winning back-runs tested (full week)" : "winning back-runs tested (last 23 windows)"]],
      body: ["If order were being sold off-protocol, winning back-runs should cluster in the chunks of the selling producers. They do not, at the resolution of this test. A null result is not proof that no order is sold."],
      src: "Whitepaper §2, §3d",
    },
    {
      id: "intents", tab: "Public swaps", q: "What do swaps cost users?", kicker: "NEAR Intents · public settlement", title: "Mostly app fees, not solver spread",
      lead: `On swaps that settle in public, users pay ${f1(n.intents.totalBps)} bps against mid. Integrator fees carried in the user's own signed intent are three quarters of it.`,
      nums: [[f1(n.intents.appFeeBps) + " bps", "integrator / app fees"], [f1(n.intents.solverBps) + " bps", "solver spread (CI includes 0)"], [n.intents.protocolBps.toFixed(2) + " bps", "protocol fee"], [Math.round(n.intents.under100Bps) + " bps", "all-in under $100"]],
      body: [`This public slice is only about ${f1(n.intents.coveragePct)} % of the volume an aggregator reports for NEAR Intents. The rest is mostly routed through a confidential bridge.`],
      src: "Whitepaper §3b",
    },
    ...(t ? [{
      id: "treasury", tab: "Confidential", q: "And the confidential route?", kicker: "NEAR Intents · confidential settlement", title: "A fee layer we can price but not split",
      lead: `The account in ${f1(n.intents.hubTxPct)} % of Intents transactions is the Treasury of a private bridge: 1Click shields the deposit, the trade settles out of public view, and the output is released back. Shield and release are public, so the all-in cost is measurable.`,
      nums: [[f1(t.allBps) + " bps", `all priced quotes (CI ${f1(t.allCI[0])}–${f1(t.allCI[1])})`], [f1(t.otherBps) + " bps", "non-stablecoin pairs"], [f1(t.sameBps) + " bps", "same asset across chains, price-free"], [usd(t.costPerDay) + "/day", "paid by users, scaled"]],
      body: [`The typical quote pays about ${Math.round(t.medianQuoteBps)} bps; large stablecoin and bitcoin quotes pull the value-weighted figure down. Pricing more tokens moves it to ${f1(t.robustBps)} bps. Who receives it, and how much is solver spread, happens on the private ledger.`],
      src: "Whitepaper §3e",
    } as Finding] : []),
    {
      id: "order", tab: "Policy", q: "Would selling order help?", kicker: "Policy", title: "It would capture very little today",
      lead: `On-chain arbitrage is about ${n.rhea.issuancePct.toFixed(2)} % of the chain's maximum issuance. Even at a hundred times its size it stays under ${Math.ceil(n.rhea.issuancePct * 100)} %.`,
      nums: [[n.rhea.issuancePct.toFixed(2) + " %", "arbitrage / max issuance"], [usd(n.rhea.meanPerDay) + "/day", "registered estimator incl. the spike"]],
      body: ["A priority fee was proposed (NEP-541) and closed. The money in trading on NEAR sits in the distribution layer that routes users' orders, not in transaction order."],
      src: "Whitepaper §1, §7, §8",
    },
    {
      id: "trust", tab: "Verification", q: "How do we know it’s right?", kicker: "Verification", title: "Recomputed, proved, timestamped",
      lead: `Every headline number is recomputed offline from stored, hashed data by a script with ${n.verify.passed ?? "all"} pass/fail checks. The algebra behind the claims is machine-checked in Lean 4.`,
      nums: [[`${n.verify.passed ?? "—"}/${(n.verify.passed ?? 0) + n.verify.failed}`, "offline checks passing"], ["Lean 4", "proofs, no sorry"], ["v1–v4", "pre-registered hypotheses"], ["18:06", "UTC OpenTimestamps stamp"]],
      body: [`The pre-registration's SHA-256 (${n.prereg.sha256.slice(0, 12)}…) was taken ${n.prereg.hashedAt} and stamped publicly at ${n.prereg.stampedAt}. Departures from it are disclosed. All data come from read-only public APIs over blocks ${n.range.from.toLocaleString("en-US")}–${n.range.to.toLocaleString("en-US")}.`],
      src: "README, Whitepaper §8–§9",
    },
  ];

  const outputs: { key: string; label: string; meta: string; view: View }[] = ([
    { key: "lite", label: "Litepaper", meta: `${site.papers.lite?.words.toLocaleString("en-US") ?? 0} words`, view: { kind: "paper", which: "lite" } },
    { key: "white", label: "Whitepaper", meta: `${site.papers.white?.words.toLocaleString("en-US") ?? 0} words`, view: { kind: "paper", which: "white" } },
    { key: "charts", label: "Charts", meta: "per window", view: { kind: "charts" } },
    { key: "code", label: "Code", meta: `${o.code.length} files`, view: { kind: "files", set: "code", file: 0 } },
    { key: "results", label: "Results", meta: `${o.results.length} JSON files`, view: { kind: "files", set: "results", file: 0 } },
    { key: "proofs", label: "Lean proofs", meta: "algebra, no sorry", view: { kind: "files", set: "proofs", file: 0 } },
    { key: "verify", label: "Verify log", meta: `${n.verify.passed}/${(n.verify.passed ?? 0) + n.verify.failed} pass`, view: { kind: "files", set: "verify", file: 0 } },
    { key: "prereg", label: "Pre-registration", meta: `sha ${n.prereg.sha256.slice(0, 8)}…`, view: { kind: "files", set: "prereg", file: 0 } },
  ] as { key: string; label: string; meta: string; view: View }[]).filter(x => x.view.kind !== "files" || o[x.view.set].length);

  const open = useCallback((v: View) => {
    setView(v);
    setState(v.kind === "files" ? "focus" : "read");
    const h = v.kind === "paper" ? (v.which === "lite" ? "litepaper" : "whitepaper") : v.kind === "charts" ? "charts" : v.kind === "files" ? v.set : v.id;
    history.replaceState(null, "", "#" + h);
  }, []);
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

  // boot morph, then honour a deep link; later hash changes (links, back button) open or close views too
  useEffect(() => {
    const byHash: Record<string, View> = { litepaper: { kind: "paper", which: "lite" }, whitepaper: { kind: "paper", which: "white" }, charts: { kind: "charts" } };
    for (const k of Object.keys(o) as OutKind[]) if (o[k].length) byHash[k] = { kind: "files", set: k, file: 0 };
    for (const f of findings) byHash[f.id] = { kind: "finding", id: f.id };
    const apply = () => { const v = byHash[location.hash.slice(1)]; if (v) open(v); else setState("home"); };
    const id = setTimeout(apply, 120);
    addEventListener("hashchange", apply);
    return () => { clearTimeout(id); removeEventListener("hashchange", apply); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // every new view starts at its top
  useEffect(() => { scrollRef.current?.scrollTo({ top: 0 }); }, [view]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  }, [close]);

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
  if (mobile) {
    let y = 0;
    for (const id of MOBILE_ORDER) {
      const h = id === "hero" ? Math.round(size.vh * 0.62) : MOBILE_H[id];
      rects[id] = { x: 0, y, w: size.W, h };
      y += h + gap;
    }
    innerH = y - gap;
  } else if (size.W) {
    rects = compute(LAYOUTS[state], size.W, size.H, gap);
  }
  // a hidden tile sits (faded) at its home position, so it fades out in place and slides in from there
  const home = !mobile && size.W ? compute(LAYOUTS.home, size.W, size.H, gap) : rects;

  const tileStyle = (id: TileId): React.CSSProperties => {
    if (!size.W) return { visibility: "hidden" };
    const r = rects[id];
    const shown = r ?? home[id] ?? { x: size.W / 2, y: size.H / 2, w: 0, h: 0 };
    return { left: shown.x, top: shown.y, width: shown.w, height: shown.h, opacity: r ? 1 : 0, transform: r ? "none" : "scale(0.94)", pointerEvents: r ? undefined : "none" };
  };
  const heroStyle: React.CSSProperties = mobile && reading ? { position: "fixed", left: gap, top: gap, width: `calc(100vw - ${2 * gap}px)`, height: `calc(100dvh - ${2 * gap}px)`, zIndex: 50 } : tileStyle("hero");

  const paper = view.kind === "paper" ? site.papers[view.which] : null;
  const finding = view.kind === "finding" ? findings.find(f => f.id === view.id) : null;
  const files = view.kind === "files" ? o[view.set] : null;
  const file = files && view.kind === "files" ? files[Math.min(view.file, files.length - 1)] : null;
  const activeKey = view.kind === "paper" ? view.which : view.kind === "charts" ? "charts" : view.kind === "files" ? view.set : "";

  return (
    <main className={`frame${mobile ? " mobile" : ""}${mobile && reading ? " locked" : ""}`} ref={frameRef}>
      <div className="stage" style={{ height: mobile ? innerH : "100%" }} data-state={state}>
        {/* brand */}
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
            {stats.map((_, i) => (
              <button key={i} aria-label={`Show stat ${i + 1}`} aria-current={i === stat} onClick={() => setStat(i)} />
            ))}
          </div>
        </section>

        {/* findings */}
        <section className="tile" style={tileStyle("faq")}>
          <div className="pad">
            <span className="label">Findings</span>
            <ul className="faq-list">
              {findings.map(f => (
                <li key={f.id}>
                  <button aria-current={reading && view.kind === "finding" && view.id === f.id} onClick={() => open({ kind: "finding", id: f.id })}>{f.q}</button>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* hero ↔ reader */}
        <section className={`tile hero${reading ? " reading" : ""}`} style={heroStyle}>
          <div className="layer" data-on={!reading}>
            <Bars series={site.series.arbPerWindow} running={!reading && state !== "boot"} />
            <div className="hero-title">
              <span className="hero-kicker">Yuki · thesis track · {n.range.dates}</span>
              <h1>Order isn’t for sale.<br />So who gets paid?</h1>
              <p>Each rod is a slice of the week; its glowing capsule is that slice’s on-chain arbitrage profit. The longest is a single six-minute router event.</p>
            </div>
          </div>
          <div className="layer" data-on={reading} aria-hidden={!reading}>
            <div className="reader">
              <div className="reader-bar">
                <div className="seg" role="group" aria-label="Choose view">
                  {state === "focus"
                    ? outputs.filter(x => x.view.kind === "files").map(x => (
                        <button key={x.key} aria-pressed={activeKey === x.key} onClick={() => open(x.view)}>{x.label}</button>
                      ))
                    : (<>
                        <button aria-pressed={view.kind === "paper" && view.which === "lite"} onClick={() => open({ kind: "paper", which: "lite" })}>Litepaper</button>
                        <button aria-pressed={view.kind === "paper" && view.which === "white"} onClick={() => open({ kind: "paper", which: "white" })}>Whitepaper</button>
                        <button aria-pressed={view.kind === "charts"} onClick={() => open({ kind: "charts" })}>Charts</button>
                        {findings.map(f => (
                          <button key={f.id} aria-pressed={view.kind === "finding" && view.id === f.id} onClick={() => open({ kind: "finding", id: f.id })}>{f.tab}</button>
                        ))}
                      </>)}
                </div>
                <button className="close" onClick={close} aria-label="Close reader">Close <span aria-hidden>×</span></button>
              </div>
              {paper ? (
                <div className="reader-body">
                  <nav className="toc" aria-label="Contents">
                    {paper.toc.map(h => (
                      <a key={h.id} href={"#" + h.id} className={"l" + h.level} onClick={e => { e.preventDefault(); scrollRef.current?.querySelector("#" + CSS.escape(h.id))?.scrollIntoView({ behavior: "smooth" }); }}>{h.text}</a>
                    ))}
                  </nav>
                  <div className="scroll" ref={scrollRef}>
                    <article className="paper">
                      <h1 className="paper-title">{paper.title}</h1>
                      <div className="paper-kind">{view.kind === "paper" && view.which === "lite" ? "Litepaper" : "Whitepaper · full record"}</div>
                      <div dangerouslySetInnerHTML={{ __html: paper.html }} />
                    </article>
                  </div>
                </div>
              ) : view.kind === "charts" ? (
                <iframe title="Charts" src="/charts.html" style={{ flex: 1, minHeight: 0, width: "100%", border: 0 }} />
              ) : files && file && view.kind === "files" ? (
                <div className="reader-body">
                  <nav className="toc files-nav" aria-label="Files">
                    {files.map((f, i) => (
                      <a key={f.path} href="#" className={i === view.file ? "on" : ""} onClick={e => { e.preventDefault(); setView({ ...view, file: i }); }}>{f.path}</a>
                    ))}
                  </nav>
                  <div className="scroll" ref={scrollRef}>
                    <div className="file-head">{file.path}<span>{file.text.split("\n").length.toLocaleString("en-US")} lines</span></div>
                    <CodeView file={file} />
                  </div>
                </div>
              ) : finding ? (
                <div className="scroll" ref={scrollRef} style={{ flex: 1, minHeight: 0 }}>
                  <article className="answer swap-in" key={finding.id}>
                    <div className="kicker">{finding.kicker}</div>
                    <h2>{finding.title}</h2>
                    <p className="lead">{finding.lead}</p>
                    <div className="nums">
                      {finding.nums.map(([v, l]) => (
                        <div className="num" key={l}><b>{v}</b><span>{l}</span></div>
                      ))}
                    </div>
                    {finding.body.map((p, i) => <p key={i}>{p}</p>)}
                    <div className="src">Source: {finding.src}</div>
                    <div className="more">
                      <button className="pill" onClick={() => open({ kind: "paper", which: "white" })}>Read it in the whitepaper</button>
                    </div>
                  </article>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        {/* thesis summary */}
        <section className="tile dark" style={tileStyle("sum")}>
          <div className="pad">
            <span className="label">The thesis in five lines</span>
            <ol className="sum-list">
              <li><b>Order isn’t sold.</b> No priority fee and no tips; fees are burnt and validators are paid from issuance.</li>
              <li><b>Arbitrage is small.</b> About {usd(n.rhea.baselinePerDay)} a day on Rhea, half of it to three bots.</li>
              <li><b>Public swaps cost {f1(n.intents.totalBps)} bps,</b> {f1(n.intents.appFeeBps)} of it app fees in the user’s own intent.</li>
              {t && <li><b>The confidential route costs about {f1(t.allBps)} bps</b> all-in, {usd(t.costPerDay)} a day, and the chain can’t say who gets it.</li>}
              <li><b>So value goes to distribution,</b> not to order. Selling order would capture little.</li>
            </ol>
          </div>
        </section>

        {/* validators + checks, one card */}
        <section className="tile ice" style={tileStyle("val")}>
          <div className="val">
            <button className="half" onClick={() => open({ kind: "finding", id: "validators" })}>
              <span className="label">To validators</span>
              <span className="big-num">0 %</span>
              <span className="cap">of the fee stream</span>
            </button>
            <button className="half" onClick={() => open({ kind: "files", set: "verify", file: 0 })}>
              <span className="label">Offline checks</span>
              <span className="big-num">{n.verify.passed ?? "—"}<span style={{ opacity: 0.4 }}>/{(n.verify.passed ?? 0) + n.verify.failed}</span></span>
              <span className="cap">recomputed from hashed data</span>
            </button>
          </div>
        </section>

        {/* bottom row */}
        <section className="tile frost" style={tileStyle("proof")}>
          <div className="pad">
            <span className="label">★ A traced quote</span>
            <span className="big-num" style={{ marginTop: "auto", fontSize: "min(20cqw, 30cqh)" }}>21.7<span style={{ fontSize: "0.4em", marginLeft: 4 }}>bps</span></span>
            <p className="cap" style={{ marginTop: 8, color: "var(--ink)" }}>$57k NBTC → USDT: shielded, released 9 s later, withdrawn.</p>
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
                <button key={x.key} className={`out${reading && activeKey === x.key ? " on" : ""}`} onClick={() => open(x.view)}>
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
