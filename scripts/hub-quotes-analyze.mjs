// Yuki: OFFLINE. All-in user cost of 1Click quotes routed through 51e8f94d... (the Treasury of the Private PoA Bridge
// between intents.near and intents.far, per the NEAR Intents docs; the swap itself settles on intents.far and is not
// visible here). Input: fixtures/hub-quotes.json.gz. Per quote (one per-quote implicit account): X of token A is sent
// to the Treasury (shield) and Y of token B is released back to the same account (unshield), which then withdraws.
//  totalBps = (usd(X) - usd(Y)) / usd(X), both at the Binance 1-minute mid of the release tx (market drift excluded).
// It includes every fee charged on the private side (1Click platform/app fees, protocol fee) and the solver spread;
// it cannot split them. Value-weighted means with a seeded bootstrap over quotes; per-day values scale the sample to
// the full-range tx count exactly as the coverage analysis does. Post hoc; not pre-registered.
// Run: node --dns-result-order=ipv4first --max-old-space-size=2048 scripts/hub-quotes-analyze.mjs   -> results/hub-quotes.json
import fs from 'node:fs';
import { readJson, sum, med, round } from '../lib/io.mjs';
import { makePricing, HUB, STABLE, sizeBucket } from '../lib/intents.mjs';
export function analyzeHubQuotes() {
  const Q = readJson('fixtures/hub-quotes.json');
  const META = { ...readJson('fixtures/intents-meta.json').META, ...readJson('fixtures/intents-meta-extra.json').META };
  const { usd } = makePricing(META, readJson('fixtures/intents-klines.json'));
  const cov = readJson('results/coverage.json');
  const perTxToDay = cov.sample.fullRangeTxs / cov.sample.txs / cov.sample.days;
  const quotes = []; const status = {};
  for (const [acct, A] of Object.entries(Q.accounts)) {
    const tsOf = Object.fromEntries(A.txs.map(t => [t.tx, t.ts]));
    const ev = A.txs.map(t => ({ ...t, ...(Q.txs[t.tx] || { ev: [] }) })).sort((x, y) => x.h - y.h);
    const tr = []; for (const t of ev) for (const e of t.ev) if (e.ok && e.event === 'transfer') for (const d of e.data) tr.push({ tx: t.tx, h: t.h, ts: tsOf[t.tx], from: d.account_id, to: d.receiver_id, tokens: d.tokens });
    const toHub = tr.filter(d => d.from === acct && d.to === HUB);
    const fromHub = tr.filter(d => d.from === HUB && d.to === acct);
    const st = (s, extra = {}) => { status[s] = (status[s] || 0) + 1; return { acct, status: s, ...extra }; };
    if (toHub.length !== 1 || Object.keys(toHub[0].tokens).length !== 1) { quotes.push(st(toHub.length ? 'multi-transfer-to-hub' : 'no-transfer-to-hub')); continue; }
    const [tA, xs] = Object.entries(toHub[0].tokens)[0];
    const pay = fromHub.filter(d => d.h >= toHub[0].h);
    if (pay.length !== 1 || Object.keys(pay[0].tokens).length !== 1) { quotes.push(st(pay.length ? 'multi-release' : 'no-release-in-span', { tA })); continue; }
    const [tB, ys] = Object.entries(pay[0].tokens)[0];
    const ts = pay[0].ts, vX = usd({ [tA]: xs }, ts), vY = usd({ [tB]: ys }, ts);
    const withdrew = ev.some(t => t.ev.some(e => e.ok && /_withdraw$/.test(e.event) && e.data.some(d => d.account_id === acct)));
    quotes.push(st(tA === tB ? 'same-token release' : 'swap', {
      tA, tB, xs, ys, symA: META[tA]?.symbol ?? null, symB: META[tB]?.symbol ?? null, h: pay[0].h, ts, secondsToRelease: round((pay[0].ts - toHub[0].ts) / 1000, 1), withdrew,
      usdIn: vX, usdOut: vY, totalBps: vX && vY != null ? (vX - vY) / vX * 1e4 : null,
    }));
  }
  const priced = quotes.filter(q => q.status === 'swap' && q.totalBps != null);
  let seed = 20261114; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const ratioCI = arr => { const out = []; for (let b = 0; b < 2000; b++) { let n = 0, d = 0; for (let i = 0; i < arr.length; i++) { const q = arr[Math.floor(rnd() * arr.length)]; n += q.usdIn - q.usdOut; d += q.usdIn; } out.push(n / d * 1e4); } out.sort((a, b) => a - b); return [round(out[50]), round(out[1949])]; };
  const dist = xs => { const s = xs.slice().sort((a, b) => a - b); const p = f => round(s[Math.min(s.length - 1, Math.floor(f * s.length))]); return { p10: p(0.1), median: p(0.5), p90: p(0.9) }; };
  const block = arr => arr.length ? ({ quotes: arr.length, usdIn: round(sum(arr, q => q.usdIn)), totalBps: round(sum(arr, q => q.usdIn - q.usdOut) / sum(arr, q => q.usdIn) * 1e4), ci95: ratioCI(arr), perQuoteBps: dist(arr.map(q => q.totalBps)) }) : { quotes: 0 };
  const isStable = q => STABLE.test(q.symA || '') && STABLE.test(q.symB || '');
  const bySize = {}; for (const q of priced) (bySize[sizeBucket(q.usdIn)] ||= []).push(q);
  const byPair = {}; for (const q of priced) (byPair[q.symA + '->' + q.symB] ||= []).push(q);
  const same = quotes.filter(q => q.status === 'same-token release');
  // Robustness: extra Binance pairs for tokens the base pricing leaves out, and USDC at the USDCUSDT close instead of $1.
  const robust = () => {
  let robustness = null;
  if (fs.existsSync('fixtures/hub-quotes-klines.json')) {
    const K = readJson('fixtures/hub-quotes-klines.json'); const px = {}; for (const [k, v] of Object.entries(K)) if (k !== 'span' && Array.isArray(v)) px[k] = new Map(v);
    const base = makePricing(META, readJson('fixtures/intents-klines.json'));
    const EXTRA = { XRP: 'XRPUSDT', LTC: 'LTCUSDT', POL: 'POLUSDT', SUI: 'SUIUSDT', PEPE: 'PEPEUSDT', SHIB: 'SHIBUSDT', BCH: 'BCHUSDT', PENGU: 'PENGUUSDT', DOGE: 'DOGEUSDT' };
    const at = (sym, ts) => { const m = px[sym]; if (!m) return null; const k = Math.floor(ts / 60000) * 60000; return m.get(k) ?? m.get(k - 60000) ?? null; };
    const priceOf = (t, ts) => { const sym = META[t]?.symbol; if (!sym) return null; if (/^USDC(\.E)?$/i.test(sym)) return at('USDCUSDT', ts); if (EXTRA[sym.toUpperCase()]) return at(EXTRA[sym.toUpperCase()], ts); return base.priceOf(t, ts); };
    const val = (t, a, ts) => { const p = priceOf(t, ts); return p == null ? null : Number(BigInt(a)) / 10 ** META[t].decimals * p; };
    const re = quotes.filter(q => q.status === 'swap').map(q => ({ ...q, usdIn: val(q.tA, q.xs, q.ts), usdOut: val(q.tB, q.ys, q.ts) })).filter(q => q.usdIn && q.usdOut != null);
    robustness = { note: 'Extra pairs (XRP, LTC, POL, SUI, PEPE, SHIB, BCH, PENGU, DOGE) and USDC at the Binance USDCUSDT close; other stables still at $1.', all: block(re), stableToStable: block(re.filter(isStable)), other: block(re.filter(q => !isStable(q))), sameAssetCrossChain: block(re.filter(q => q.symA === q.symB)), userCostPerDayUsd: Math.round(sum(re, q => q.usdIn - q.usdOut) * perTxToDay), unpricedSwaps: quotes.filter(q => q.status === 'swap').length - re.length };
  }
  return robustness; };
  const res = {
    note: 'Post hoc; not pre-registered. Frame: per-quote implicit accounts that send to the Treasury 51e8f94d... in the random intents.near tx sample. totalBps = all-in user cost (private-side fees + solver spread) against the Binance 1-minute mid at release; only quotes whose both tokens are priced (NEAR, BTC, ETH, SOL, ZEC, TRX, BNB, TON, stables). Treasury identity from the NEAR Intents docs, not from chain data.',
    frame: { accounts: quotes.length, status },
    all: { ...block(priced), medianUsdIn: round(med(priced.map(q => q.usdIn))) },
    stableToStable: block(priced.filter(isStable)),
    other: block(priced.filter(q => !isStable(q))),
    sameAssetCrossChain: block(priced.filter(q => q.symA === q.symB)), // price-free: same asset on both sides
    perDay: { pricedSwapVolumeUsd: Math.round(sum(priced, q => q.usdIn) * perTxToDay), userCostUsd: Math.round(sum(priced, q => q.usdIn - q.usdOut) * perTxToDay), scale: round(perTxToDay, 4) },
    bySize: Object.fromEntries(['<$100', '$100-1k', '$1k-10k', '$10k-100k', '>=$100k'].filter(b => bySize[b]).map(b => [b, block(bySize[b])])),
    topPairs: Object.entries(byPair).map(([k, v]) => ({ pair: k, quotes: v.length, usdIn: round(sum(v, q => q.usdIn)), totalBps: round(sum(v, q => q.usdIn - q.usdOut) / sum(v, q => q.usdIn) * 1e4) })).sort((a, b) => b.usdIn - a.usdIn).slice(0, 12),
    sameTokenRelease: { quotes: same.length, medianBps: same.length ? round(med(same.map(q => q.totalBps).filter(v => v != null))) : null },
    unpricedSwaps: quotes.filter(q => q.status === 'swap').length - priced.length,
    quotes,
  };
  res.robustness = robust(); // after the main blocks, so they keep the same bootstrap draws
  return res;
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const r = analyzeHubQuotes(); fs.writeFileSync('results/hub-quotes.json', JSON.stringify(r, null, 1));
  console.log(JSON.stringify({ ...r, quotes: undefined }, null, 1));
}
