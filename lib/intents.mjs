// Yuki: NEAR Intents token_diff analysis. Pure function over fixtures, no network.
// Part 1 ("original") ports the pack's intents-analyze.mjs (same pricing, solver rule, seed) and must reproduce its JSON.
// Part 2 ("extended", post hoc) adds: app fees = `transfer` intents signed under a user's own intent hash and sent to a
// non-solver third party; the full user-cost stack; breakdowns by integrator (referral) and trade size; solver-rule
// sensitivity; fragility (top swap, top 5); the corrected FOREIGN rule (adds *.omdep.near) next to the registered one.
import { sha256, sum, bootstrap } from './io.mjs';

export const STABLE = /^(USDC|USDT|USDT0|USDC\.E|USD₮|USDT\.E|DAI)$/i;
export const PAIR = s => /^(W?NEAR)$/i.test(s) ? 'NEARUSDT' : /^(W?BTC|NBTC|XBTC|CBBTC)$/i.test(s) ? 'BTCUSDT' : /^(W?ETH|WEETH)$/i.test(s) ? 'ETHUSDT' : /^(W?SOL)$/i.test(s) ? 'SOLUSDT' : /^ZEC$/i.test(s) ? 'ZECUSDT' : /^TRX$/i.test(s) ? 'TRXUSDT' : /^W?BNB$/i.test(s) ? 'BNBUSDT' : /^TON$/i.test(s) ? 'TONUSDT' : null;
const REGISTERED_PAIRS = new Set(['NEARUSDT', 'BTCUSDT', 'ETHUSDT', 'SOLUSDT']);
export const FOREIGN_V4 = id => /\.omft\.near$|\.factory\.bridge\.near$|^nep141:nbtc\.bridge\.near$/.test(id);
export const FOREIGN_FIXED = id => FOREIGN_V4(id) || /\.omdep\.near$/.test(id); // post-hoc fix (review §1.5)
export const HUB = '51e8f94d77b5e90dc9852ca6113771e11e8382ce69473a75e313e41665de7cbe';
export const TOP_MM = '6247d9c671ca6a80cf2c75e26edb8cd75ebf00fcd3c56c39107d6ca20c9cfb29';

export function makePricing(META, klines, { registeredOnly = false } = {}) {
  const px = {}; for (const [k, v] of Object.entries(klines)) if (Array.isArray(v)) px[k] = new Map(v);
  const priceOf = (t, ts) => { const m = META[t]; if (!m) return null; if (STABLE.test(m.symbol)) return 1; const p = PAIR(m.symbol); if (!p || !px[p]) return null; if (registeredOnly && !REGISTERED_PAIRS.has(p)) return null; const k = Math.floor(ts / 60000) * 60000; return px[p].get(k) ?? px[p].get(k - 60000) ?? null; };
  const usd = (map, ts) => { let v = 0; for (const [t, a] of Object.entries(map)) { const p = priceOf(t, ts); if (p == null) return null; v += Number(BigInt(a)) / 10 ** META[t].decimals * p; } return v; };
  return { priceOf, usd };
}
export const integrator = ref => { if (!ref) return '(none)'; if (/^solver-/.test(ref)) return 'solver rebalancing'; let r = ref.replace(/^1click-/, '1click:'); if (/^1click:aurora/.test(r)) return '1click:aurora (all)'; if (/^1click:[0-9a-f-]{20,}$/.test(r)) return '1click:(opaque id)'; return r; };
export const sizeBucket = v => v < 100 ? '<$100' : v < 1e3 ? '$100-1k' : v < 1e4 ? '$1k-10k' : v < 1e5 ? '$10k-100k' : '>=$100k';
const BUCKETS = ['<$100', '$100-1k', '$1k-10k', '$10k-100k', '>=$100k'];

export function analyzeIntents({ raw, counts, meta, META, klines, events, solverRule = { min: 20 }, registeredOnly = false, label = 'base', feeRule = 'notCounterparty' }) {
  const seen = new Set();
  const rows = raw.trim().split('\n').filter(Boolean).map(l => JSON.parse(l)).filter(x => { const k = x.tx + ':' + x.intent + ':' + x.acct; if (seen.has(k)) return false; seen.add(k); return x.ok; });
  const tokens = new Set(rows.flatMap(x => [...Object.keys(x.diff), ...Object.keys(x.fees)]));
  const { priceOf, usd } = makePricing(META, klines, { registeredOnly });
  const n = {}; for (const x of rows) n[x.acct] = (n[x.acct] || 0) + 1;
  let SOLVER;
  if (solverRule.set) SOLVER = new Set(solverRule.set);
  else { SOLVER = new Set(Object.entries(n).filter(([, c]) => c >= solverRule.min).map(([a]) => a)); for (const a of solverRule.remove || []) SOLVER.delete(a); for (const a of solverRule.add || []) SOLVER.add(a); }
  const byTx = new Map(); for (const x of rows) (byTx.get(x.tx) || byTx.set(x.tx, []).get(x.tx)).push(x);
  const W = counts.windows; const winOf = h => W.findIndex(w => h >= w.from && h <= w.to + 5);
  const outUsd = x => { let out = 0; for (const [t, a] of Object.entries(x.diff)) if (BigInt(a) < 0n) { const p = priceOf(t, x.ts); if (p != null) out += -Number(BigInt(a)) / 10 ** META[t].decimals * p; } return out; };
  const swaps = [];
  for (const [tx, xs] of byTx) {
    const vals = xs.map(x => ({ x, v: usd(x.diff, x.ts), f: usd(x.fees, x.ts) }));
    const priced = vals.every(o => o.v != null && o.f != null);
    const solverV = sum(vals.filter(o => SOLVER.has(o.x.acct)), o => o.v ?? 0);
    const userV = sum(vals.filter(o => !SOLVER.has(o.x.acct)), o => o.v ?? 0);
    const fees = sum(vals, o => o.f ?? 0);
    const volume = sum(vals.filter(o => !SOLVER.has(o.x.acct)), o => outUsd(o.x));
    swaps.push({ tx, xs, w: winOf(xs[0].h), ts: xs[0].ts, priced, parties: xs.length, solvers: xs.filter(x => SOLVER.has(x.acct)).map(x => x.acct), solverV, userCost: -userV, fees, volume, ref: xs.find(x => x.ref)?.ref || null, identityGap: priced ? Math.abs(-userV - solverV - fees) : null });
  }
  const P = swaps.filter(s => s.priced && s.solvers.length > 0);
  const solverCap = sum(P, s => s.solverV), userCost = sum(P, s => s.userCost), feesTot = sum(P, s => s.fees), vol = sum(P, s => s.volume);
  const bySolver = {}; for (const s of P) for (const a of new Set(s.solvers)) bySolver[a] = (bySolver[a] || 0) + s.solverV / new Set(s.solvers).size;
  const topS = Object.entries(bySolver).sort((a, b) => b[1] - a[1]);
  const pos = sum(topS.filter(([, v]) => v > 0), ([, v]) => v);
  const top3 = sum(topS.slice(0, 3), ([, v]) => Math.max(0, v)) / (pos || 1);
  const sampledTx = sum(W, w => w.txs), scale = counts.fullRange / sampledTx, days = (meta.end - meta.start + 1) * 0.5787 / 86400;
  const perDay = v => +(v * scale / days).toFixed(2);
  const perWin = f => { const a = new Array(W.length).fill(0); for (const s of P) if (s.w >= 0) a[s.w] += f(s); return a; };
  const boot = (arr, seed) => bootstrap(arr, seed, 2000, 1).map(v => +(v * scale / days).toFixed(2));
  const wSolver = perWin(s => s.solverV);
  const ranked = wSolver.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]);
  const original = {
    range: [meta.start, meta.end], windows: W.length, days: +days.toFixed(2),
    sample: { entries: rows.length, swaps: swaps.length, pricedSwapsWithSolver: P.length, unpricedSwaps: swaps.filter(s => !s.priced).length, noSolverSwaps: swaps.filter(s => s.priced && !s.solvers.length).length, sampledTx, fullRangeTx: counts.fullRange, scale: +scale.toFixed(3) },
    noMetadataTokens: [...tokens].filter(t => !META[t]).length, noMetadataEntries: rows.filter(x => Object.keys(x.diff).some(t => !META[t])).length,
    solvers: { count: SOLVER.size, top: topS.slice(0, 10).map(([a, v]) => [a, +v.toFixed(2), +(Math.max(0, v) / (pos || 1) * 100).toFixed(1)]), top3SharePct: +(top3 * 100).toFixed(1) },
    perDay: { volumeUsd: perDay(vol), userCostUsd: perDay(userCost), solverCaptureUsd: perDay(solverCap), solverCaptureCI95: boot(wSolver, 7), protocolFeesUsd: perDay(feesTot) },
    bps: { userCost: +(userCost / vol * 1e4).toFixed(2), solverCapture: +(solverCap / vol * 1e4).toFixed(2), protocolFees: +(feesTot / vol * 1e4).toFixed(2) },
    identity: { maxGapUsd: +Math.max(0, ...P.map(s => s.identityGap)).toFixed(6), note: 'sanity check only: the contract enforces sum(diffs)+fees=0 per token, so this holds by construction' },
    spike: { topWindowSharePct: +((ranked[0]?.[0] || 0) / (sum(wSolver) || 1) * 100).toFixed(1), topWindowFrom: W[ranked[0]?.[1]]?.from, medianWindowUsd: +([...wSolver].sort((a, b) => a - b)[Math.floor(wSolver.length / 2)] || 0).toFixed(2) },
    inputSha256: sha256(raw),
  };
  // flows (v4), registered FOREIGN rule and the post-hoc fixed rule
  const flows = FOREIGN => {
    let netNear = 0, outward = 0, inward = 0, f2f = 0, nearSide = 0, uv = 0;
    for (const s of P) for (const x of s.xs.filter(r => !SOLVER.has(r.acct))) {
      const w = x.diff['nep141:wrap.near']; if (w) netNear += Number(BigInt(w)) / 1e24;
      const outs = Object.entries(x.diff).filter(([, a]) => BigInt(a) < 0n), ins = Object.entries(x.diff).filter(([, a]) => BigInt(a) > 0n);
      const v = outUsd(x); uv += v;
      const outF = outs.every(([t]) => FOREIGN(t)), inF = ins.length && ins.every(([t]) => FOREIGN(t));
      if (!outF && inF) outward += v; else if (outF && !inF) inward += v; else if (outF && inF) f2f += v; else nearSide += v;
    }
    const p = v => +(v / (uv || 1) * 100).toFixed(1);
    return { netNearPerDay: +(netNear * scale / days).toFixed(1), outwardSharePct: p(outward), inwardSharePct: p(inward), foreignToForeignSharePct: p(f2f), nearSideSharePct: p(nearSide), outwardPerDayUsd: perDay(outward), inwardPerDayUsd: perDay(inward), foreignToForeignPerDayUsd: perDay(f2f), nearSidePerDayUsd: perDay(nearSide), outward, uv };
  };
  const fl4 = flows(FOREIGN_V4), flFix = flows(FOREIGN_FIXED);
  original.flows = Object.fromEntries(Object.entries(fl4).filter(([k]) => !['outward', 'uv'].includes(k)));
  original.killCriteria = {
    KC6_solverCaptureUnder350PerDay: original.perDay.solverCaptureUsd < 350,
    KC7_top3Under60: top3 < 0.6,
    KC8_feesAtLeastSolverCapture: feesTot >= solverCap,
    KC9_fewerThan200PricedSwaps: P.length < 200,
    KC10_netNearFlowNonNegative: original.flows.netNearPerDay >= 0,
    KC11_outwardShareAtLeast50: fl4.outward / (fl4.uv || 1) >= 0.5,
    KC12_userCostAtLeast154bps: userCost / vol * 1e4 >= 1.54,
  };

  // ---------------- Part 2: app fees and the full user-cost stack ----------------
  const fees = []; let feeUnpriced = 0;
  for (const s of P) {
    s.appFee = 0; s.appFeeCapped = 0;
    const userIntents = new Map(s.xs.filter(x => !SOLVER.has(x.acct)).map(x => [x.intent, x]));
    const partyAccts = new Set(s.xs.map(x => x.acct));
    const counterparties = new Set(s.xs.filter(x => SOLVER.has(x.acct)).map(x => x.acct));
    for (const e of events[s.tx] || []) {
      if (!e.ok || e.event !== 'transfer') continue;
      for (const d of e.data) {
        if (!userIntents.has(d.intent_hash) || d.receiver_id === d.account_id) continue;
        // notCounterparty (default): receiver is not a solver-side party of this same swap. notAnySolver (review appfees.mjs): receiver is not in the global solver set.
        if (feeRule === 'notAnySolver' ? SOLVER.has(d.receiver_id) : counterparties.has(d.receiver_id)) continue;
        const v = usd(d.tokens, s.ts); if (v == null) { feeUnpriced++; continue; }
        const bps = v / (s.volume || 1) * 1e4;
        fees.push({ tx: s.tx, w: s.w, from: d.account_id, to: d.receiver_id, toIsParty: partyAccts.has(d.receiver_id), usd: v, bps, swapVol: s.volume, ref: s.ref });
        s.appFee += v; if (bps <= 200) s.appFeeCapped += v;
      }
    }
  }
  const appFee = sum(P, s => s.appFee), appFeeCapped = sum(P, s => s.appFeeCapped);
  const medOf = a => { const z = a.slice().sort((x, y) => x - y); return z[Math.floor(z.length / 2)]; };
  const byRecipient = {}; for (const f of fees) (byRecipient[f.to] ||= []).push(f);
  const recipients = Object.entries(byRecipient).map(([to, fs]) => ({ to, transfers: fs.length, swaps: new Set(fs.map(f => f.tx)).size, perDayUsd: perDay(sum(fs, f => f.usd)), medianBps: +medOf(fs.map(f => f.bps)).toFixed(2), maxBps: +Math.max(...fs.map(f => f.bps)).toFixed(1), refs: [...new Set(fs.map(f => integrator(f.ref)))].slice(0, 6) })).sort((a, b) => b.perDayUsd - a.perDayUsd);
  const stackOf = list => { const v = sum(list, s => s.volume); const sc = sum(list, s => s.solverV), af = sum(list, s => s.appFee), pf = sum(list, s => s.fees); return { swaps: list.length, volumePerDayUsd: perDay(v), solverBps: +(sc / v * 1e4).toFixed(2), appFeeBps: +(af / v * 1e4).toFixed(2), protocolBps: +(pf / v * 1e4).toFixed(3), totalBps: +((sc + af + pf) / v * 1e4).toFixed(2), solverPerDayUsd: perDay(sc), appFeePerDayUsd: perDay(af), swapsWithAppFee: list.filter(s => s.appFee > 0).length }; };
  const byInt = {}; for (const s of P) (byInt[integrator(s.ref)] ||= []).push(s);
  const byIntegrator = Object.entries(byInt).map(([k, l]) => ({ integrator: k, ...stackOf(l) })).sort((a, b) => b.volumePerDayUsd - a.volumePerDayUsd);
  const bySz = {}; for (const s of P) (bySz[sizeBucket(s.volume)] ||= []).push(s);
  const bySize = BUCKETS.filter(b => bySz[b]).map(b => ({ bucket: b, ...stackOf(bySz[b]) }));
  const topSwaps = P.slice().sort((a, b) => b.solverV - a.solverV);
  const top1 = topSwaps[0];
  const wApp = perWin(s => s.appFee), wTot = perWin(s => s.solverV + s.appFee + s.fees);
  const unpriced = swaps.filter(s => !s.priced);
  const extended = {
    note: 'Post hoc additions (not pre-registered). App fee = transfer intent signed under a user-side intent hash of the same swap tx, to a receiver that is not a solver and not the sender. Fee-like by size pattern [judgment]; recipient identities unverified.',
    label, feeRule, solverRule: solverRule.set ? 'explicit set' : `>= ${solverRule.min} entries` + (solverRule.remove?.length ? ` minus ${solverRule.remove.length}` : '') + (solverRule.add?.length ? ` plus ${solverRule.add.length}` : ''),
    stack: { ...stackOf(P), protocolPerDayUsd: perDay(feesTot), userCostInclAppFeesPerDayUsd: perDay(userCost + appFee), appFeeCappedPerDayUsd: perDay(appFeeCapped), appFeeCappedBps: +(appFeeCapped / vol * 1e4).toFixed(2), appFeeTransfers: fees.length, appFeeTransfersUnpriced: feeUnpriced, appFeeTransfersOver200bps: fees.filter(f => f.bps > 200).length, appFeeTransfersOver200bpsUsdSample: +sum(fees.filter(f => f.bps > 200), f => f.usd).toFixed(2), appFeeToSwapPartyTransfers: fees.filter(f => f.toIsParty).length, appFeeCI95: boot(wApp, 11), totalUserCostCI95: boot(wTot, 13) },
    recipients: recipients.slice(0, 12), recipientCount: recipients.length,
    byIntegrator, bySize,
    fragility: { topSwap: { tx: top1.tx, volumeUsd: +top1.volume.toFixed(0), solverUsd: +top1.solverV.toFixed(2), solverBps: +(top1.solverV / top1.volume * 1e4).toFixed(1), appFeeUsd: +top1.appFee.toFixed(2), ref: top1.ref, sharePctOfSolverCapture: +(top1.solverV / solverCap * 100).toFixed(1), tokens: [...new Set(top1.xs.flatMap(x => Object.keys(x.diff)))].map(t => META[t]?.symbol || t.slice(0, 24)) }, top5SharePct: +(sum(topSwaps.slice(0, 5), s => s.solverV) / solverCap * 100).toFixed(1), exTopSwapSolverPerDayUsd: perDay(solverCap - top1.solverV), exTopSwapSolverBps: +((solverCap - top1.solverV) / (vol - top1.volume) * 1e4).toFixed(2), negativeSwaps: P.filter(s => s.solverV < 0).length, topSolverAcct: topS[0]?.[0], topSolverEntries: n[topS[0]?.[0]] },
    coverage: { unpricedSwaps: unpriced.length, unpricedSwapsPricedLegUserVolPerDayUsd: perDay(sum(unpriced, s => s.volume)), pricedSwapsWithSolver: P.length, pricedNoSolver: swaps.filter(s => s.priced && !s.solvers.length).length },
    flowsFixedOmdep: Object.fromEntries(Object.entries(flFix).filter(([k]) => !['outward', 'uv'].includes(k))),
    flowsFixedKC11: flFix.outward / (flFix.uv || 1) >= 0.5,
    perWindow: W.map((w, i) => ({ i, from: w.from, solverUsd: +wSolver[i].toFixed(3), appFeeUsd: +wApp[i].toFixed(3) })),
    solverList: [...SOLVER].sort().map(a => [a, n[a]]),
  };
  return { original, extended, n, P, scale, days };
}
