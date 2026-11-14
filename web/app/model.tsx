"use client";

import { useEffect, useState } from "react";
import { WindowBars } from "./charts";

// The value-accrual model, same arithmetic as the offline model script:
//   issuance/day = supply x inflation / 365 x price;  offset = (buyback + burn) / issuance;
//   buyback = volume x fee rate x holders' share;  breakeven volume = (issuance - burn) / (fee rate x share).
export type ModelBase = { volumePerDay: number; feeBps: number; holdersSharePct: number; gasBurnPerDay: number; supplyNear: number; inflationPct: number; nearUsd: number };

function run(m: ModelBase) {
  const issuance = (m.supplyNear * (m.inflationPct / 100) / 365) * m.nearUsd;
  const holderRate = (m.feeBps / 1e4) * (m.holdersSharePct / 100);
  const buyback = m.volumePerDay * holderRate;
  const breakeven = holderRate > 0 ? (issuance - m.gasBurnPerDay) / holderRate : Infinity;
  return { issuance, buyback, offsetPct: ((buyback + m.gasBurnPerDay) / issuance) * 100, breakeven, multiple: breakeven / m.volumePerDay };
}
const usd = (v: number) => (v >= 1e9 ? `$${(v / 1e9).toFixed(2)}B` : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(1)}k` : `$${v.toFixed(0)}`);

function Slider({ label, value, onChange, min, max, step, fmt }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step: number; fmt: (v: number) => string }) {
  return (
    <label className="slider">
      <span className="sl-head"><span>{label}</span><b>{fmt(value)}</b></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(+e.target.value)} />
    </label>
  );
}

export function ModelSlide({ base }: { base: ModelBase }) {
  const [m, setM] = useState(base);
  const r = run(m);
  const S = (k: keyof ModelBase) => ({ value: m[k], onChange: (v: number) => setM({ ...m, [k]: v }) });
  return (
    <div className="model">
      <div className="sliders">
        <Slider {...S("volumePerDay")} label="Intents volume / day" min={10e6} max={2e9} step={5e6} fmt={usd} />
        <Slider {...S("feeBps")} label="Fee rate" min={2} max={60} step={0.5} fmt={v => `${v.toFixed(1)} bps`} />
        <Slider {...S("holdersSharePct")} label="Holders' share of fees" min={0} max={100} step={1} fmt={v => `${v.toFixed(0)} %`} />
        <Slider {...S("nearUsd")} label="NEAR price" min={0.5} max={20} step={0.05} fmt={v => `$${v.toFixed(2)}`} />
        <Slider {...S("inflationPct")} label="Annual inflation" min={0.5} max={5} step={0.1} fmt={v => `${v.toFixed(1)} %`} />
        <Slider {...S("gasBurnPerDay")} label="Gas burnt / day" min={0} max={200e3} step={500} fmt={usd} />
        <button className="pill ghost" onClick={() => setM(base)}>Reset to last 30 days</button>
      </div>
      <div className="model-out">
        <div className="num big"><b>{r.offsetPct.toFixed(1)} %</b><span>of issuance offset by buyback + burn</span></div>
        <div className="num"><b>{usd(r.buyback)}</b><span>buyback per day</span></div>
        <div className="num"><b>{usd(r.issuance)}</b><span>issuance per day</span></div>
        <div className="num"><b>{Number.isFinite(r.multiple) ? `${r.multiple.toFixed(1)}×` : "never"}</b><span>volume needed to offset issuance ({Number.isFinite(r.breakeven) ? usd(r.breakeven) : "—"}/day)</span></div>
        <div className="meter" aria-hidden><div style={{ width: `${Math.min(100, r.offsetPct)}%` }} /></div>
      </div>
    </div>
  );
}

type Live = { at: string; vol30: number; fees30: number; rev30: number; price: number; supply: number; height: number; rev90: number[] } | { error: string } | null;
export function LiveSlide({ base, snapshot }: { base: ModelBase; snapshot: { offsetPct: number; fetchedAt: string } }) {
  const [live, setLive] = useState<Live>(null);
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const get = (u: string, init?: RequestInit) => fetch(u, init).then(r => { if (!r.ok) throw new Error(`${r.status} ${u}`); return r.json(); });
        const [vol, fees, rev, px, blk] = await Promise.all([
          get("https://api.llama.fi/summary/dexs/near-intents"),
          get("https://api.llama.fi/summary/fees/near-intents?dataType=dailyFees"),
          get("https://api.llama.fi/summary/fees/near-intents?dataType=dailyHoldersRevenue"),
          get("https://coins.llama.fi/prices/current/coingecko:near"),
          get("https://rpc.mainnet.near.org", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "block", params: { finality: "final" } }) }),
        ]);
        const tail = (s: { totalDataChart: [number, number][] }, n: number) => s.totalDataChart.slice(-n).map(p => p[1]);
        const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
        const h = blk.result.header;
        if (!dead) setLive({
          at: new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC",
          vol30: mean(tail(vol, 30)), fees30: mean(tail(fees, 30)), rev30: mean(tail(rev, 30)),
          price: px.coins["coingecko:near"].price, supply: Number(BigInt(h.total_supply) / BigInt("1000000000000000000000")) / 1e3, height: h.height, rev90: tail(rev, 90),
        });
      } catch (e) { if (!dead) setLive({ error: e instanceof Error ? e.message : String(e) }); }
    })();
    return () => { dead = true; };
  }, []);
  if (!live) return <p className="lead">Fetching live data from DefiLlama and NEAR RPC…</p>;
  if ("error" in live) return <p className="lead">Live fetch failed ({live.error}). The snapshot model above still holds; try again later.</p>;
  const m: ModelBase = { ...base, volumePerDay: live.vol30, feeBps: (live.fees30 / live.vol30) * 1e4, holdersSharePct: (live.rev30 / live.fees30) * 100, nearUsd: live.price, supplyNear: live.supply };
  const r = run(m);
  const peak = live.rev90.reduce((mi, v, i, a) => (v > a[mi] ? i : mi), 0);
  return (
    <>
      <p className="lead">Pulled just now ({live.at}) in your browser from DefiLlama’s public API and NEAR RPC (block {live.height.toLocaleString("en-US")}). The snapshot in the papers, fetched {snapshot.fetchedAt.slice(0, 10)}, gave {snapshot.offsetPct.toFixed(1)} % at the study week’s price.</p>
      <div className="nums">
        <div className="num"><b>{r.offsetPct.toFixed(1)} %</b><span>of issuance offset now (buyback + burn)</span></div>
        <div className="num"><b>{usd(live.rev30)}</b><span>buyback / day, last 30 days</span></div>
        <div className="num"><b>{usd(live.vol30)}</b><span>Intents volume / day, last 30 days</span></div>
        <div className="num"><b>${live.price.toFixed(2)}</b><span>NEAR price now</span></div>
        <div className="num"><b>{r.multiple.toFixed(1)}×</b><span>volume needed to offset issuance</span></div>
        <div className="num"><b>{(live.supply / 1e9).toFixed(3)}B</b><span>NEAR supply on chain</span></div>
      </div>
      <WindowBars values={live.rev90} mark={{ index: peak, text: "highest day in the last 90" }} label="NEAR Intents holders' revenue (buyback) per day, last 90 days" axis={["90 days ago", "yesterday"]} unit="day" />
      <p className="chart-note">Gas burn is held at the snapshot’s 30-day value; inflation at 2.5 %. DefiLlama series are secondary data built on NEAR-uploaded datasets.</p>
    </>
  );
}
