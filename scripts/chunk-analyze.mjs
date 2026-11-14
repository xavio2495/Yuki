// Yuki: OFFLINE (review item 9). Do winning Rhea back-runs cluster in chunks of particular chunk producers?
// Input: fixtures/chunk-authors.json (from scripts/chunk-fetch.mjs). Two tests, both by chunk producer (validator):
//  T1 (vs schedule): producers of the chunks that INCLUDED winning back-run txs, against each shard's producer mix at
//     uniformly random heights in the same windows. Monte Carlo p-value of the chi-square statistic (2000 draws).
//  T2 (vs failures): winners vs failed attempts by the same bot signers, inclusion-chunk producer, label permutation
//     within shard (2000 permutations).
// If order were being sold by producers, winners should over-represent the selling producers. Post hoc; optional test.
// Run: node --dns-result-order=ipv4first --max-old-space-size=2048 scripts/chunk-analyze.mjs  -> results/chunk-producers.json
import fs from 'node:fs';
import { readJson } from '../lib/io.mjs';
export function analyzeChunks() {
  const F = readJson('fixtures/chunk-authors.json'); const C = F.chunks;
  const auth = k => C[k]?.author ?? null;
  const shardOfKey = k => +k.split(':')[1];
  const win = F.items.filter(i => i.group === 'win' && auth(i.incl)), fail = F.items.filter(i => i.group === 'fail' && auth(i.incl));
  const rand = F.items.filter(i => i.group === 'random');
  const shards = [...new Set(win.map(i => shardOfKey(i.incl)))];
  const base = {}; for (const s of shards) { base[s] = {}; for (const r of rand) { const a = auth(r.h + ':' + s); if (a) base[s][a] = (base[s][a] || 0) + 1; } }
  let seed = 3; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  // T1
  const obs = {}, exp = {}; const nByShard = {};
  for (const i of win) { const s = shardOfKey(i.incl), a = auth(i.incl); nByShard[s] = (nByShard[s] || 0) + 1; obs[s + '|' + a] = (obs[s + '|' + a] || 0) + 1; }
  for (const s of shards) { const tot = Object.values(base[s]).reduce((x, y) => x + y, 0); for (const [a, c] of Object.entries(base[s])) exp[s + '|' + a] = nByShard[s] * c / tot; }
  const chi = o => { let x = 0; for (const k of new Set([...Object.keys(exp), ...Object.keys(o)])) { const e = Math.max(exp[k] || 0, 0.5); x += ((o[k] || 0) - e) ** 2 / e; } return x; };
  const chiObs = chi(obs);
  let ge = 0; const sims = 2000;
  const cdf = {}; for (const s of shards) { const e = Object.entries(base[s]); const tot = e.reduce((x, [, c]) => x + c, 0); let acc = 0; cdf[s] = e.map(([a, c]) => [a, (acc += c) / tot]); }
  for (let b = 0; b < sims; b++) { const o = {}; for (const s of shards) for (let j = 0; j < nByShard[s]; j++) { const u = rnd(); const a = cdf[s].find(([, p]) => u <= p)[0]; o[s + '|' + a] = (o[s + '|' + a] || 0) + 1; } if (chi(o) >= chiObs) ge++; }
  const unexplained = win.filter(i => !(shardOfKey(i.incl) + '|' + auth(i.incl) in exp)).length;
  const over = Object.entries(obs).map(([k, o]) => ({ shardProducer: k, observed: o, expected: +(exp[k] || 0).toFixed(1), ratio: exp[k] ? +(o / exp[k]).toFixed(2) : null })).sort((x, y) => y.observed - x.observed).slice(0, 8);
  // T2: winners vs failures, same signers, permutation within shard
  const both = [...win.map(i => ({ ...i, y: 1 })), ...fail.map(i => ({ ...i, y: 0 }))];
  const stat = arr => { const t = {}; for (const i of arr) { const k = shardOfKey(i.incl) + '|' + auth(i.incl); (t[k] ||= [0, 0])[i.y]++; } const W = arr.filter(i => i.y).length, N = arr.length; let x = 0; for (const [, [f, w]] of Object.entries(t)) { const n = f + w, ew = n * W / N, ef = n - ew; x += (w - ew) ** 2 / Math.max(ew, 0.5) + (f - ef) ** 2 / Math.max(ef, 0.5); } return x; };
  const t2 = stat(both); let ge2 = 0;
  const strataPerm = (strata, statFn) => { const obs = statFn(both); let g = 0; for (let b = 0; b < sims; b++) { const perm = []; for (const arr of Object.values(strata)) { const ys = arr.map(i => i.y); for (let j = ys.length - 1; j > 0; j--) { const k = Math.floor(rnd() * (j + 1)); [ys[j], ys[k]] = [ys[k], ys[j]]; } arr.forEach((i, j) => perm.push({ ...i, y: ys[j] })); } if (statFn(perm) >= obs) g++; } return { chiSquare: +obs.toFixed(1), permutationP: +((g + 1) / (sims + 1)).toFixed(4) }; };
  // T2b: same, but labels permuted within shard x 600-block window (controls for epoch / producer-schedule drift over time)
  const winOfH = h => Math.floor((h - 223455000) / 6220);
  const byShardWin = {}; for (const i of both) (byShardWin[shardOfKey(i.incl) + '|' + winOfH(+i.incl.split(':')[0])] ||= []).push(i);
  const t2b = strataPerm(byShardWin, stat);
  const byShard = {}; for (const i of both) (byShard[shardOfKey(i.incl)] ||= []).push(i);
  for (let b = 0; b < sims; b++) { const perm = []; for (const arr of Object.values(byShard)) { const ys = arr.map(i => i.y); for (let j = ys.length - 1; j > 0; j--) { const k = Math.floor(rnd() * (j + 1)); [ys[j], ys[k]] = [ys[k], ys[j]]; } arr.forEach((i, j) => perm.push({ ...i, y: ys[j] })); } if (stat(perm) >= t2) ge2++; }
  const execSame = win.filter(i => auth(i.exec) && auth(i.exec) === auth(i.incl)).length;
  return {
    note: 'Optional, post hoc. Restricted to heights >= 224,360,000 (the last ~23 of 168 windows; the public archival endpoint did not serve older chunks on 2026-11-14). Tests clustering, not intent: a null result means no detectable producer-level pattern, not proof that no order is sold.',
    coverage: { winningBackrunsTested: win.length, failedComparators: fail.length, randomHeights: rand.length, shards, sameLayoutAtRangeEnds: F.sameLayoutAtRangeEnds, chunkErrors: Object.values(C).filter(x => x.error).length },
    T1_vsSchedule: { chiSquare: +chiObs.toFixed(1), monteCarloP: +((ge + 1) / (sims + 1)).toFixed(4), winnersWithProducerUnseenInBaseline: unexplained, topCells: over },
    T2_vsFailedSameSigners: { chiSquare: +t2.toFixed(1), permutationP: +((ge2 + 1) / (sims + 1)).toFixed(4), strata: 'shard' },
    T2b_vsFailedSameSigners_withinWindow: { ...t2b, strata: 'shard x window', mixedStrata: Object.values(byShardWin).filter(a => a.some(i => i.y) && a.some(i => !i.y)).length, winnersInMixedStrata: Object.values(byShardWin).filter(a => a.some(i => !i.y)).reduce((n, a) => n + a.filter(i => i.y).length, 0) },
    inclusionProducerEqualsExecutionProducer: { n: execSame, of: win.length },
    distinctProducersInWinners: new Set(win.map(i => auth(i.incl))).size,
  };
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const r = analyzeChunks(); fs.writeFileSync('results/chunk-producers.json', JSON.stringify(r, null, 1)); console.log(JSON.stringify(r, null, 1));
}
