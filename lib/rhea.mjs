// Yuki: Rhea (Ref v2 + DCL) receipt-level arbitrage analysis. Pure function over fixtures, no network.
// Part 1 ("original") is a line-for-line port of the pack's rhea-mev-analyze.mjs (same rules, same seed), so its
// numbers must reproduce the pack's results JSON. Part 2 ("extended") adds the robust baseline, spike anatomy,
// operator concentration, 300 s markouts and the positive markout tail. Part 2 is post hoc (not pre-registered).
import { sha256, med, sum, bootstrap, round } from './io.mjs';

export const NEAR = 'wrap.near';
export const USDC = '17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1';
const STABLE = new Set([USDC, 'usdt.tether-token.near', 'a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.factory.bridge.near', 'dac17f958d2ee523a2206206994597c13d831ec7.factory.bridge.near']);
const DEC0 = { 'wrap.near': 24, [USDC]: 6, 'usdt.tether-token.near': 6, 'zec.omft.near': 8, 'prl.omft.near': 8, 'qtc.omft.near': 12 };

export function analyzeRhea({ raw, counts, meta, decimals, klines }) {
  const seen = new Set();
  const hops = raw.trim().split('\n').map(l => JSON.parse(l)).map(x => { x.tin = x.tin.replace(/,$/, ''); x.tout = x.tout.replace(/,$/, ''); return x; }).filter(x => { const k = x.rid + ':' + x.hop; if (seen.has(k)) return false; seen.add(k); return true; });
  const ok = hops.filter(x => x.ok);
  const DEC = { ...DEC0 };
  const tokens = new Set(ok.flatMap(x => [x.tin, x.tout]));
  for (const t of tokens) if (DEC[t] === undefined) DEC[t] = decimals[t] ?? null;
  const amt = (a, t) => DEC[t] == null ? null : Number(BigInt(a)) / 10 ** DEC[t];
  const px = new Map(klines);
  const nearUsd = ts => px.get(Math.floor(ts / 60000) * 60000) ?? px.get(Math.floor(ts / 60000) * 60000 - 60000) ?? null;
  const rates = {};
  for (const x of ok) {
    const ai = amt(x.ain, x.tin), ao = amt(x.aout, x.tout); if (!ai || !ao) continue; const n = nearUsd(x.ts); if (!n) continue;
    const push = (t, usd) => (rates[t] ||= []).push(usd);
    if (x.tin === NEAR) push(x.tout, ai * n / ao); else if (x.tout === NEAR) push(x.tin, ao * n / ai);
    else if (STABLE.has(x.tin)) push(x.tout, ai / ao); else if (STABLE.has(x.tout)) push(x.tin, ao / ai);
  }
  const medRate = {}; for (const [t, r] of Object.entries(rates)) medRate[t] = med(r);
  const usdOf = (t, a, ts) => { const v = amt(a, t); if (v == null) return null; if (STABLE.has(t)) return v; if (t === NEAR) { const n = nearUsd(ts); return n ? v * n : null; } const r = rates[t]; return r && r.length >= 3 ? v * medRate[t] : null; };
  const W = counts.windows; const winOf = h => W.findIndex(w => h >= w.from && h <= w.to + 5);
  const byTx = new Map(); for (const x of ok) (byTx.get(x.tx) || byTx.set(x.tx, []).get(x.tx)).push(x);
  const order = (a, b) => a.h - b.h || a.idx - b.idx || a.hop - b.hop;
  const txs = [];
  for (const [tx, xs] of byTx) {
    xs.sort(order);
    const first = xs[0], last = xs.at(-1);
    const w = winOf(first.txh);
    const volUsd = xs.reduce((s, x) => s + (usdOf(x.tin, x.ain, x.ts) ?? 0), 0);
    const gasUsd = Number(BigInt(first.burnt)) / 1e24 * (nearUsd(first.ts) ?? 0);
    const cyc = xs.length >= 2 && first.tin === last.tout;
    let profitUsd = null;
    if (cyc) {
      const ext = BigInt(last.aout) - BigInt(first.ain);
      profitUsd = usdOf(first.tin, (ext < 0n ? -ext : ext).toString(), first.ts); if (profitUsd != null && ext < 0n) profitUsd = -profitUsd;
    }
    txs.push({ tx, w, txh: first.txh, sender: first.sender, signer: first.signer, txrecv: first.txrecv, n: xs.length, cyc, token: first.tin, profitUsd, gasUsd, volUsd, h: first.h, ts: first.ts, pools: [...new Set(xs.map(x => x.pool))] });
  }
  const arbs = txs.filter(t => t.cyc && t.profitUsd != null);
  const grossArb = sum(arbs, t => Math.max(0, t.profitUsd));
  const netArb = sum(arbs, t => t.profitUsd - t.gasUsd);
  const shareBy = (list, key) => { const m = {}; let T = 0; for (const t of list) { const p = Math.max(0, t.profitUsd); m[t[key]] = (m[t[key]] || 0) + p; T += p; } return { T, e: Object.entries(m).sort((a, b) => b[1] - a[1]) }; };
  const { e: topSenders } = shareBy(arbs, 'sender');
  const top3Share = sum(topSenders.slice(0, 3), x => x[1]) / (grossArb || 1);
  // sandwiches and back-runs (unchanged rules)
  const byPool = {}; for (const x of ok) (byPool[x.pool] ||= []).push(x);
  const isArbTx = new Set(arbs.map(t => t.tx));
  const sandwiches = [], backruns = [];
  for (const [pool, xs] of Object.entries(byPool)) {
    xs.sort(order);
    for (let i = 0; i < xs.length; i++) {
      const a = xs[i];
      for (let j = i + 1; j < xs.length && xs[j].h - a.h <= 2; j++) {
        const v = xs[j]; if (v.sender === a.sender || v.tin !== a.tin) continue;
        for (let k = j + 1; k < xs.length && xs[k].h - a.h <= 2; k++) {
          const c = xs[k]; if (c.sender !== a.sender || c.tin !== a.tout || c.tout !== a.tin) continue;
          const profit = Number(BigInt(c.aout) - BigInt(a.ain)) / 10 ** (DEC[a.tin] ?? 0);
          const closes = Math.abs(Number(BigInt(c.ain) - BigInt(a.aout))) / Number(BigInt(a.aout) || 1n) < 0.05;
          const pUsd = usdOf(a.tin, (BigInt(c.aout) - BigInt(a.ain) < 0n ? BigInt(a.ain) - BigInt(c.aout) : BigInt(c.aout) - BigInt(a.ain)).toString(), a.ts);
          sandwiches.push({ pool, attacker: a.sender, victim: v.sender, txs: [a.tx, v.tx, c.tx], heights: [a.h, v.h, c.h], idx: [a.idx, v.idx, c.idx], profitInToken: profit, profitUsd: pUsd == null ? null : (profit < 0 ? -pUsd : pUsd), token: a.tin, profitable: profit > 0, closesPosition: closes, sameTxAB: a.tx === v.tx });
          break;
        }
      }
      const n = xs[i + 1];
      if (n && !isArbTx.has(a.tx) && isArbTx.has(n.tx) && n.h - a.h <= 1 && n.tx !== a.tx) backruns.push({ pool, user: a.sender, bot: n.sender, txs: [a.tx, n.tx], dh: n.h - a.h, h: n.h, userH: a.h });
    }
  }
  const swapCount = {}; for (const x of ok) swapCount[x.sender] = (swapCount[x.sender] || 0) + 1;
  for (const s of sandwiches) { s.victimSwaps = swapCount[s.victim]; s.attackerSwaps = swapCount[s.attacker]; s.strict = s.profitable && s.closesPosition && s.victimSwaps < 20; }
  const failTx = new Map(); for (const x of hops) if (!x.ok) failTx.set(x.tx, x);
  for (const x of ok) failTx.delete(x.tx);
  const failBySender = {}; let failGasUsd = 0, failCyclic = 0;
  for (const [, x] of failTx) { failBySender[x.sender] = (failBySender[x.sender] || 0) + 1; failGasUsd += Number(BigInt(x.burnt)) / 1e24 * (nearUsd(x.ts) ?? 0); }
  const hopsByTx = new Map(); for (const x of hops) (hopsByTx.get(x.tx) || hopsByTx.set(x.tx, []).get(x.tx)).push(x);
  for (const [tx] of failTx) { const xs = hopsByTx.get(tx).slice().sort(order); if (xs.length >= 2 && xs[0].tin === xs.at(-1).tout) failCyclic++; }
  const backrunArbTx = new Set(backruns.map(b => b.txs[1]));
  const backrunProfit = sum(arbs.filter(t => backrunArbTx.has(t.tx)), t => Math.max(0, t.profitUsd));
  // markouts (original: +60 s; extended: +300 s), wNEAR/stable directional swaps, non-arb txs
  const mk = [], mkBy = {}, mk300 = [], mkBy300 = {};
  for (const x of ok) {
    if (isArbTx.has(x.tx)) continue;
    const pair = (x.tin === NEAR && STABLE.has(x.tout)) || (x.tout === NEAR && STABLE.has(x.tin)); if (!pair) continue;
    const gain = p => x.tin === NEAR ? amt(x.aout, x.tout) - amt(x.ain, x.tin) * p : amt(x.aout, x.tout) * p - amt(x.ain, x.tin);
    const vol = x.tin === NEAR ? amt(x.aout, x.tout) : amt(x.ain, x.tin);
    const p60 = px.get(Math.floor((x.ts + 60000) / 60000) * 60000);
    if (p60) { const g = gain(p60); mk.push({ g, w: winOf(x.txh), s: x.sender, vol }); mkBy[x.sender] = (mkBy[x.sender] || 0) + g; }
    const p300 = px.get(Math.floor((x.ts + 300000) / 60000) * 60000);
    if (p300) { const g = gain(p300); mk300.push({ g, s: x.sender, vol, w: winOf(x.txh) }); (mkBy300[x.sender] ||= { g: 0, n: 0, vol: 0 }); mkBy300[x.sender].g += g; mkBy300[x.sender].n++; mkBy300[x.sender].vol += vol; }
  }
  const mkTop = Object.entries(mkBy).sort((a, b) => b[1] - a[1]);
  const sampledTx = W.reduce((s, w) => s + w['v2.ref-finance.near'] + w['dclv2.ref-labs.near'], 0);
  const fullTx = counts.fullRange['v2.ref-finance.near'] + counts.fullRange['dclv2.ref-labs.near'];
  const scale = fullTx / sampledTx, days = (meta.end - meta.start + 1) * 0.5787 / 86400;
  const perWin = f => { const a = new Array(W.length).fill(0); for (const t of txs) if (t.w >= 0) a[t.w] += f(t); return a; };
  const winArb = perWin(t => t.cyc && t.profitUsd != null ? Math.max(0, t.profitUsd) : 0);
  const winVol = perWin(t => t.volUsd);
  const ci = bootstrap(winArb, 42).map(v => v * scale / days);
  const volTotal = sum(winVol);
  const perDay = v => +(v * scale / days).toFixed(2);
  // Deviation from the pack script: the median NEAR price is taken over the sample span only (the pack took it over every
  // fetched kline, which depends on when the fetch ran). Effect: 3.598 -> see results.
  const tA = Math.floor(Math.min(...ok.map(x => x.ts)) / 60000) * 60000 - 60000, tB = Math.max(...ok.map(x => x.ts)) + 120000;
  const SUPPLY = 1311676443, INFL = 1 / 40, nearAvg = med([...px.entries()].filter(([t]) => t >= tA && t <= tB).map(([, v]) => v));
  const issuanceUsdYr = SUPPLY * INFL * nearAvg;
  const arbYr = grossArb * scale / days * 365;
  const original = {
    range: [meta.start, meta.end], windows: W.length, blocksPerWindow: meta.blocksPerWindow, days: +days.toFixed(2),
    sample: { hops: hops.length, okHops: ok.length, failedHops: hops.length - ok.length, txsWithSwaps: txs.length, sampledTxCount: sampledTx, fullRangeTxCount: fullTx, scale: +scale.toFixed(3) },
    unpricedTokenCount: [...tokens].filter(t => usdOf(t, '1' + '0'.repeat(DEC[t] ?? 0), Math.min(...ok.map(x => x.ts))) == null).length,
    volume: { sampledUsd: +volTotal.toFixed(0), perDayUsd: perDay(volTotal) },
    cyclicArb: { count: arbs.length, perDayCount: perDay(arbs.length), grossUsdSample: +grossArb.toFixed(2), netAfterGasUsdSample: +netArb.toFixed(2), grossPerDayUsd: perDay(grossArb), ci95PerDayUsd: ci.map(v => +v.toFixed(2)), bpsOfVolume: +(grossArb / volTotal * 1e4).toFixed(2), losingCount: arbs.filter(t => t.profitUsd < 0).length, gasUsdSample: +sum(arbs, t => t.gasUsd).toFixed(2), gasPctOfGross: +(sum(arbs, t => t.gasUsd) / grossArb * 100).toFixed(2), topSenders: topSenders.slice(0, 10).map(([s, v]) => [s, +v.toFixed(2), +(v / grossArb * 100).toFixed(1)]), top3SharePct: +(top3Share * 100).toFixed(1), distinctSenders: topSenders.length },
    backruns: { count: backruns.length, arbProfitFromBackrunsUsdSample: +backrunProfit.toFixed(2), sharePct: +(backrunProfit / (grossArb || 1) * 100).toFixed(1) },
    sandwiches: { candidates: sandwiches.length, profitable: sandwiches.filter(s => s.profitable).length, strict: sandwiches.filter(s => s.strict).length, strictList: sandwiches.filter(s => s.strict), pairs: Object.entries(sandwiches.reduce((m, s) => { const k = s.attacker + ' > ' + s.victim; m[k] = (m[k] || 0) + 1; return m; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 5) },
    failedAttempts: { txs: failTx.size, cyclicShapedFailed: failCyclic, perDay: perDay(failTx.size), gasUsdSample: +failGasUsd.toFixed(2), gasUsdPerDay: perDay(failGasUsd), topSenders: Object.entries(failBySender).sort((a, b) => b[1] - a[1]).slice(0, 8) },
    cexDexMarkout60s: { swaps: mk.length, sumGainUsdSample: +sum(mk, x => x.g).toFixed(2), positiveGainUsdSample: +sum(mk.filter(x => x.g > 0), x => x.g).toFixed(2), perDayNetUsd: perDay(sum(mk, x => x.g)), top: mkTop.slice(0, 8).map(([s, v]) => [s, +v.toFixed(2)]), volUsdSample: +sum(mk, x => x.vol).toFixed(0) },
    issuance: { supplyNear: SUPPLY, maxInflation: INFL, nearUsdMedian: nearAvg, issuanceUsdPerYear: +issuanceUsdYr.toFixed(0), arbGrossUsdPerYear: +arbYr.toFixed(0), arbPctOfIssuance: +(arbYr / issuanceUsdYr * 100).toFixed(4), x100PctOfIssuance: +(arbYr * 100 / issuanceUsdYr * 100).toFixed(3) },
    inputSha256: sha256(raw),
  };
  original.killCriteria = {
    KC1_fewerThan30Arbs: arbs.length < 30,
    KC2_under100PerDay: original.cyclicArb.grossPerDayUsd < 100,
    KC3_strictSandwichCandidates: original.sandwiches.strict,
    KC4_top3Under50: top3Share < 0.5,
    KC5_x100AtLeast1pctIssuance: original.issuance.x100PctOfIssuance >= 1,
  };

  // ---------------- Part 2: extended (post hoc) ----------------
  const ranked = winArb.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]);
  const spikeW = ranked[0][1];
  const exSpike = arbs.filter(t => t.w !== spikeW);
  const exSpikeGross = sum(exSpike, t => Math.max(0, t.profitUsd));
  const winArbEx = winArb.filter((_, i) => i !== spikeW);
  const ciEx = bootstrap(winArbEx, 42).map(v => +(v * scale / days * (winArb.length / winArbEx.length)).toFixed(2));
  // operator concentration
  const s1 = shareBy(arbs, 'sender'), s2 = shareBy(arbs, 'signer'), s3 = shareBy(exSpike, 'sender');
  const pct = (e, T, k) => +(sum(e.slice(0, k), x => x[1]) / T * 100).toFixed(1);
  const hhi = (e, T) => +sum(e, x => (x[1] / T * 100) ** 2).toFixed(0);
  const family = e => e.filter(([a]) => /^[a-z0-9]+1\.near$/.test(a));
  // spike anatomy
  const W0 = W[spikeW];
  const spikeHops = ok.filter(x => x.txh >= W0.from && x.txh <= W0.to + 5);
  const spikeAll = hops.filter(x => x.txh >= W0.from && x.txh <= W0.to + 5);
  const router = spikeAll.filter(x => /near-meme-router/.test(x.sender + ' ' + x.signer + ' ' + x.txrecv));
  const routerTx = new Map(); for (const x of router) { const o = routerTx.get(x.tx) || { tx: x.tx, h: x.h, ts: x.ts, signer: x.signer, ok: true, inUsd: 0, legs: [] }; o.ok = o.ok && x.ok; if (x.hop === 0) o.inUsd += usdOf(x.tin, x.ain, x.ts) ?? 0; o.legs.push((x.tin.length > 20 ? x.tin.slice(0, 6) : x.tin) + '>' + (x.tout.length > 20 ? x.tout.slice(0, 6) : x.tout)); o.h = Math.min(o.h, x.h); routerTx.set(x.tx, o); }
  const spikeArbs = arbs.filter(t => t.w === spikeW).sort((a, b) => b.profitUsd - a.profitUsd);
  const spikeBySender = shareBy(spikeArbs, 'sender');
  const spikeBackrunProfit = sum(spikeArbs.filter(t => backrunArbTx.has(t.tx)), t => Math.max(0, t.profitUsd));
  const spikeNear = spikeHops.map(x => nearUsd(x.ts)).filter(Boolean);
  const routerList = [...routerTx.values()].sort((a, b) => a.h - b.h);
  const extended = {
    note: 'Post hoc additions (not pre-registered). Same input and pricing as the original section.',
    perWindow: W.map((w, i) => ({ i, from: w.from, arbUsd: +winArb[i].toFixed(4), volUsd: +winVol[i].toFixed(0) })),
    robust: {
      spikeWindowIndex: spikeW, spikeWindowFrom: W0.from, spikeSharePct: +(ranked[0][0] / grossArb * 100).toFixed(1), secondWindowSharePct: +(ranked[1][0] / grossArb * 100).toFixed(1), thirdWindowSharePct: +(ranked[2][0] / grossArb * 100).toFixed(1),
      medianWindowUsd: +[...winArb].sort((a, b) => a - b)[Math.floor(winArb.length / 2)].toFixed(2),
      exSpikePerDayUsd: perDay(exSpikeGross), exTop2PerDayUsd: perDay(grossArb - ranked[0][0] - ranked[1][0]),
      exSpikeCI95PerDayUsd: ciEx, exSpikeCINote: 'bootstrap over the 167 non-spike windows, rescaled to the full range (same seed 42)',
      exSpikeBpsOfVolume: +(exSpikeGross / (volTotal - winVol[spikeW]) * 1e4).toFixed(2),
      windowsWithAnyArbProfit: winArb.filter(v => v > 0).length,
    },
    concentration: {
      bySender: { top3Pct: pct(s1.e, s1.T, 3), top1Pct: pct(s1.e, s1.T, 1), hhi: hhi(s1.e, s1.T), distinct: s1.e.length, top10: s1.e.slice(0, 10).map(([a, v]) => [a, +(v / s1.T * 100).toFixed(1)]) },
      bySigner: { top3Pct: pct(s2.e, s2.T, 3), distinct: s2.e.length },
      exSpikeBySender: { top3Pct: pct(s3.e, s3.T, 3), top3: s3.e.slice(0, 3).map(([a, v]) => [a, +(v / s3.T * 100).toFixed(1)]), hhi: hhi(s3.e, s3.T) },
      animal1FamilyPct: +(sum(family(s1.e), x => x[1]) / s1.T * 100).toFixed(1), animal1FamilyMembers: family(s1.e).map(x => x[0]),
      animal1FamilyExSpikePct: +(sum(family(s3.e), x => x[1]) / s3.T * 100).toFixed(1),
      familyRule: 'name matches ^[a-z0-9]+1\\.near$ (naming only, no funding-graph check) [judgment]',
    },
    spike: {
      window: [W0.from, W0.to], hopsOk: spikeHops.length, hopsAll: spikeAll.length,
      nearUsdMinMax: [Math.min(...spikeNear), Math.max(...spikeNear)],
      routerTxs: routerList.length, routerTxsFailed: routerList.filter(o => !o.ok).length,
      routerFirst10: routerList.slice(0, 10).map(o => ({ tx: o.tx, h: o.h, ok: o.ok, inUsd: +o.inUsd.toFixed(0), signer: o.signer })),
      routerLargestOk: routerList.filter(o => o.ok).sort((a, b) => b.inUsd - a.inUsd).slice(0, 5).map(o => ({ tx: o.tx, h: o.h, inUsd: +o.inUsd.toFixed(0) })),
      arbs: spikeArbs.length, arbProfitUsdSample: +spikeBySender.T.toFixed(2), backrunSharePctOfWindow: +(spikeBackrunProfit / (spikeBySender.T || 1) * 100).toFixed(1),
      bySender: spikeBySender.e.slice(0, 8).map(([a, v]) => [a, +v.toFixed(2), +(v / spikeBySender.T * 100).toFixed(1)]),
      topArbs: spikeArbs.slice(0, 6).map(t => ({ tx: t.tx, sender: t.sender, h: t.h, profitUsd: +t.profitUsd.toFixed(2), hops: t.n })),
      firstArbHeight: Math.min(...spikeArbs.map(t => t.h)), lastArbHeight: Math.max(...spikeArbs.map(t => t.h)),
    },
    largestArbs: arbs.slice().sort((a, b) => b.profitUsd - a.profitUsd).slice(0, 5).map(t => ({ tx: t.tx, sender: t.sender, profitUsd: +t.profitUsd.toFixed(2), hops: t.n, h: t.h })),
    markout: {
      h60: { netPerDayUsd: perDay(sum(mk, x => x.g)), swaps: mk.length },
      h300: { netPerDayUsd: perDay(sum(mk300, x => x.g)), swaps: mk300.length },
      positiveTail300: (() => { const e = Object.entries(mkBy300).filter(([, o]) => o.n >= 10).sort((a, b) => b[1].g - a[1].g); const pos = e.filter(([, o]) => o.g > 0); return { accountsWith10PlusSwaps: e.length, netPositiveAccounts: pos.length, netPositiveSumPerDayUsd: perDay(sum(pos, ([, o]) => o.g)), top5: e.slice(0, 5).map(([a, o]) => ({ acct: a, swaps: o.n, volUsd: +o.vol.toFixed(0), gainUsd: +o.g.toFixed(2), bps: +(o.g / o.vol * 1e4).toFixed(1) })) }; })(),
      splitHalf300: (() => { const half = {}; for (const m of mk300) { const k = m.w < 84 ? 0 : 1; const o = (half[m.s] ||= [{ g: 0, n: 0 }, { g: 0, n: 0 }]); o[k].g += m.g; o[k].n++; } const e = Object.entries(half).filter(([, o]) => o[0].n >= 5 && o[1].n >= 5); const w1 = e.filter(([, o]) => o[0].g > 0); return { note: 'accounts with >=5 swaps in both halves (windows 1-84 vs 85-168); do first-half winners keep winning?', accounts: e.length, firstHalfWinners: w1.length, alsoWinSecondHalf: w1.filter(([, o]) => o[1].g > 0).length, firstHalfWinnersSecondHalfSumUsdSample: +sum(w1, ([, o]) => o[1].g).toFixed(2), firstHalfWinnersSecondHalfPerDayUsd: +(sum(w1, ([, o]) => o[1].g) * scale / (days * 84 / 168)).toFixed(0), firstHalfLosersSecondHalfSumUsdSample: +sum(e.filter(([, o]) => o[0].g <= 0), ([, o]) => o[1].g).toFixed(2) }; })(),
      note: 'Binance 1-minute closes only, so horizons below 60 s (e.g. 5 s) are not measurable from these fixtures',
    },
    gas: { arbGasPctOfGross: +(sum(arbs, t => t.gasUsd) / grossArb * 100).toFixed(2), failedGasPctOfGross: +(failGasUsd / grossArb * 100).toFixed(1) },
  };
  // for the chunk-producer test: winning back-run arb txs and their receipt heights
  const arbByTx = new Map(arbs.map(t => [t.tx, t]));
  const winningBackruns = [...new Map(backruns.filter(b => (arbByTx.get(b.txs[1])?.profitUsd ?? 0) > 0).map(b => [b.txs[1], { tx: b.txs[1], h: b.h, txh: arbByTx.get(b.txs[1]).txh, signer: arbByTx.get(b.txs[1]).signer, dh: b.dh, bot: b.bot, pool: b.pool, profitUsd: +arbByTx.get(b.txs[1]).profitUsd.toFixed(4), w: arbByTx.get(b.txs[1]).w }])).values()];
  const failedAttempts = [...failTx.values()].map(x => ({ tx: x.tx, h: x.h, txh: x.txh, signer: x.signer, sender: x.sender, pool: x.pool }));
  return { original, extended, winningBackruns, failedAttempts, scale, days, W };
}
