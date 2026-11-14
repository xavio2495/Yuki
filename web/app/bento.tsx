"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

type Paper = { title: string; html: string; toc: { id: string; level: number; text: string }[]; words: number } | null;
export type Site = {
  generatedAt: string;
  papers: { lite: Paper; white: Paper };
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

type Finding = { id: string; tab: string; q: string; kicker: string; title: string; lead: string; nums: [string, string][]; body: string[]; src: string };
type View = { kind: "paper"; which: "lite" | "white" } | { kind: "finding"; id: string } | { kind: "charts" };
const HASH: Record<string, View> = {
  litepaper: { kind: "paper", which: "lite" },
  whitepaper: { kind: "paper", which: "white" },
  charts: { kind: "charts" },
};

export default function Bento({ site }: { site: Site }) {
  const n = site.numbers;
  const t = n.treasury;
  const [state, setState] = useState<"boot" | "home" | "read">("boot");
  const [view, setView] = useState<View>({ kind: "paper", which: "lite" });
  const [stat, setStat] = useState(0);
  const [paperPick, setPaperPick] = useState<"lite" | "white">("lite");
  const scrollRef = useRef<HTMLDivElement>(null);
  const reading = state === "read";

  const stats: { value: ReactNode; caption: string }[] = [
    { value: <>{usd(n.rhea.baselinePerDay)}<span className="unit">/day</span></>, caption: "On-chain arbitrage on Rhea at baseline. Small, and taken by a few bots." },
    { value: <>{f1(n.intents.totalBps)}<span className="unit">bps</span></>, caption: `What users pay on public Intents swaps; ${f1(n.intents.appFeeBps)} bps of it is app fees.` },
    t ? { value: <>{usd(t.costPerDay / 1000)}k<span className="unit">/day</span></>, caption: "All-in user cost of confidential (Treasury) quotes, scaled to the week." } : { value: "—", caption: "" },
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
      nums: [[f1(n.intents.appFeeBps) + " bps", "integrator / app fees"], [f1(n.intents.solverBps) + " bps", "solver spread (CI includes 0)"], [String(n.intents.protocolBps.toFixed(2)) + " bps", "protocol fee"], [Math.round(n.intents.under100Bps) + " bps", "all-in under $100"]],
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
      lead: `On-chain arbitrage is about ${(n.rhea.issuancePct).toFixed(2)} % of the chain's maximum issuance. Even at a hundred times its size it stays under ${Math.ceil(n.rhea.issuancePct * 100)} %.`,
      nums: [[(n.rhea.issuancePct).toFixed(2) + " %", "arbitrage / max issuance"], [usd(n.rhea.meanPerDay) + "/day", "registered estimator incl. the spike"]],
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

  const open = useCallback((v: View) => {
    setView(v);
    setState("read");
    scrollRef.current?.scrollTo({ top: 0 });
    const h = v.kind === "paper" ? (v.which === "lite" ? "litepaper" : "whitepaper") : v.kind === "charts" ? "charts" : v.id;
    history.replaceState(null, "", "#" + h);
  }, []);
  const close = useCallback(() => {
    setState("home");
    history.replaceState(null, "", location.pathname);
  }, []);

  // boot morph, then honour a deep link
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const h = location.hash.slice(1);
      const v = HASH[h] ?? (findings.some(f => f.id === h) ? ({ kind: "finding", id: h } as View) : null);
      setTimeout(() => (v ? open(v) : setState("home")), 60);
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  }, [close]);

  // the carousel drives both the stat and the bento's shape while idle
  useEffect(() => {
    if (state !== "home") return;
    const id = setInterval(() => setStat(s => (s + 1) % stats.length), 7000);
    return () => clearInterval(id);
  }, [state, stats.length]);

  const paper = view.kind === "paper" ? site.papers[view.which] : null;
  const finding = view.kind === "finding" ? findings.find(f => f.id === view.id) : null;

  return (
    <main className="frame">
      <div className="bento" data-state={state} data-shape={stat}>
        {/* brand */}
        <section className="tile" style={{ gridArea: "brand" }}>
          <div className="pad">
            <div className="brand-top">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="wordmark" src="/yuki-wordmark-ink.svg" alt="Yuki" />
              <span className="chip">NEAR ’26</span>
            </div>
            <p className="brand-q">On a chain that does not sell transaction order, where does trading value go, and who pays for it?</p>
          </div>
        </section>

        {/* top row */}
        <section className="tile dark" style={{ gridArea: "t1" }} aria-label="Yuki mark">
          <div className="center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="mark" src="/yuki-mark-ice.svg" alt="" />
          </div>
        </section>
        <button className="tile ice" style={{ gridArea: "t2" }} onClick={() => open({ kind: "finding", id: "validators" })}>
          <div className="pad">
            <span className="label">To validators</span>
            <span className="big-num" style={{ marginTop: "auto" }}>0 %</span>
            <span className="cap">of the fee stream</span>
          </div>
        </button>
        <button className="tile dark" style={{ gridArea: "t3" }} onClick={() => open({ kind: "finding", id: "trust" })}>
          <div className="pad">
            <span className="label">Offline checks</span>
            <span className="big-num" style={{ marginTop: "auto" }}>{n.verify.passed ?? "—"}<span style={{ opacity: 0.4 }}>/{(n.verify.passed ?? 0) + n.verify.failed}</span></span>
            <span className="cap">recomputed from hashed data</span>
          </div>
        </button>

        {/* whitepaper cover */}
        <button className="tile cover" style={{ gridArea: "art" }} onClick={() => open({ kind: "paper", which: "white" })}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="flake" src="/yuki-mark-ice.svg" alt="" />
          <div className="pad">
            <span className="label">Whitepaper</span>
            <span className="serif" style={{ marginTop: "auto" }}>The full record</span>
            <span className="cap">{site.papers.white?.words.toLocaleString("en-US")} words · every number with its interval</span>
          </div>
        </button>

        {/* big stat carousel */}
        <section className="tile" style={{ gridArea: "big" }}>
          <div className="pad">
            <span className="label">This week on NEAR</span>
            <div key={stat} className="swap-in" style={{ marginTop: "auto" }}>
              <div className="stat-big">{stats[stat].value}</div>
              <p className="cap" style={{ marginTop: 10, maxWidth: "26ch" }}>{stats[stat].caption}</p>
            </div>
          </div>
          <div className="dots">
            {stats.map((_, i) => (
              <button key={i} aria-label={`Show stat ${i + 1}`} aria-current={i === stat} onClick={() => setStat(i)} />
            ))}
          </div>
        </section>

        {/* hero ↔ reader */}
        <section className={`tile hero${reading ? " reading" : ""}`} style={{ gridArea: "hero" }}>
          <div className="layer" data-on={!reading}>
            <div className="orb" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="hero-mark" src="/yuki-mark-ink.svg" alt="" />
            <div className="hero-cta">
              <button className="pill ghost" onClick={() => open({ kind: "paper", which: "white" })}>Whitepaper</button>
              <button className="pill" onClick={() => open({ kind: "paper", which: "lite" })}>Litepaper</button>
            </div>
            <div className="hero-title">
              <h1>Order isn’t for sale.<br />So who gets paid?</h1>
              <p>One week of NEAR mainnet ({n.range.dates}), measured layer by layer: arbitrage, validators, solvers and the apps that route your trade.</p>
            </div>
          </div>
          <div className="layer" data-on={reading} aria-hidden={!reading}>
            <div className="reader">
              <div className="reader-bar">
                <div className="seg" role="group" aria-label="Choose document">
                  <button aria-pressed={view.kind === "paper" && view.which === "lite"} onClick={() => open({ kind: "paper", which: "lite" })}>Litepaper</button>
                  <button aria-pressed={view.kind === "paper" && view.which === "white"} onClick={() => open({ kind: "paper", which: "white" })}>Whitepaper</button>
                  <button aria-pressed={view.kind === "charts"} onClick={() => open({ kind: "charts" })}>Charts</button>
                  {findings.map(f => (
                    <button key={f.id} aria-pressed={view.kind === "finding" && view.id === f.id} onClick={() => open({ kind: "finding", id: f.id })}>{f.tab}</button>
                  ))}
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

        {/* right column */}
        {t && (
          <button className="tile" style={{ gridArea: "stat" }} onClick={() => open({ kind: "finding", id: "treasury" })}>
            <div className="pad">
              <span className="label">Confidential route</span>
              <span className="big-num" style={{ marginTop: "auto" }}>{f1(t.allBps)}<span style={{ fontSize: "0.4em", marginLeft: 4 }}>bps</span></span>
              <span className="cap">all-in user cost, {t.quotes} priced quotes</span>
            </div>
          </button>
        )}
        <button className="tile cover-lite" style={{ gridArea: "lite" }} onClick={() => open({ kind: "paper", which: "lite" })}>
          <div className="pad">
            <span className="label">Litepaper</span>
            <span className="serif" style={{ marginTop: "auto" }}>One argument, four equations</span>
          </div>
        </button>

        {/* findings list */}
        <section className="tile" style={{ gridArea: "faq" }}>
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

        {/* bottom row (folds away while reading) */}
        <section className="tile frost row5" style={{ gridArea: "proof" }}>
          <div className="pad">
            <span className="label">★ A traced quote</span>
            <span className="big-num" style={{ marginTop: "auto", fontSize: "min(20cqw, 30cqh)" }}>21.7<span style={{ fontSize: "0.4em", marginLeft: 4 }}>bps</span></span>
            <p className="cap" style={{ marginTop: 8, color: "var(--ink)" }}>
              $57k NBTC → USDT: shielded, released 9 s later, withdrawn.
            </p>
            <span className="cap">— account e464353c…, on-chain</span>
          </div>
        </section>
        <section className="tile row5" style={{ gridArea: "check" }}>
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
        <section className="tile row5" style={{ gridArea: "cta" }}>
          <div className="pad">
            <button className="toggle" aria-pressed={paperPick === "white"} onClick={() => setPaperPick(p => (p === "lite" ? "white" : "lite"))}>
              <span className="track"><span className="knob" /></span>
              {paperPick === "lite" ? "litepaper" : "whitepaper"}
            </button>
            <div className="cta-title">
              {paperPick === "lite" ? `${site.papers.lite?.words.toLocaleString("en-US") ?? ""} words` : `${site.papers.white?.words.toLocaleString("en-US") ?? ""} words`}
            </div>
            <span className="cap">
              {paperPick === "lite"
                ? "The argument in journal form: method as equations, numbers only in the results."
                : "Every number with its interval, source file and the command that checks it."}
            </span>
            <button className="cta-btn" onClick={() => open({ kind: "paper", which: paperPick })}>
              Read the {paperPick === "lite" ? "litepaper" : "whitepaper"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
