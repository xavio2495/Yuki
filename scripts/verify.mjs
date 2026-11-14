// Yuki: OFFLINE verification. No network. Node >= 20 (tested on 24).
//  1. SHA-256 of every fixture file against fixtures/MANIFEST.json, of the uncompressed raw inputs against the hashes
//     the original pack published, and of PREREGISTRATION.md against the hash stated in THESIS.md.
//  2. Recomputes every headline figure from the fixtures (same code as the analysers) and compares it with
//     results/*.json. Tolerance: |recomputed - committed| <= max(0.01, 1e-6 x |committed|) (the code is deterministic).
//  3. Compares the reproduced pre-registered numbers with the values the original pack published (tolerance per row).
//  4. Labelled-hash checks: specific transactions must classify and value as stated in THESIS.md.
// Run (repo root): node --dns-result-order=ipv4first --max-old-space-size=2048 scripts/verify.mjs
// Exit code 0 = all checks pass.
import fs from 'node:fs';
import { sha256, readText, readJson } from '../lib/io.mjs';
import { analyzeRhea } from '../lib/rhea.mjs';
import { analyzeIntents } from '../lib/intents.mjs';
import { loadRhea } from './rhea-analyze.mjs';
import { loadIntents, sensitivity } from './intents-analyze.mjs';
import { analyzeCoverage } from './hub-analyze.mjs';
import { analyzeChunks } from './chunk-analyze.mjs';
import { analyzeHubQuotes } from './hub-quotes-analyze.mjs';
globalThis.fetch = () => { throw new Error('network is disabled inside verify'); };
const t0 = Date.now();
let pass = 0, fail = 0; const lines = [];
const row = (ok, what, got, want, note = '') => { ok ? pass++ : fail++; lines.push(`${ok ? 'PASS' : 'FAIL'}  ${what.padEnd(58)} ${String(got).padStart(16)}  ${('vs ' + want).padEnd(22)} ${note}`); };
const near = (a, b, abs = 0.01, rel = 1e-6) => Array.isArray(b) ? a.length === b.length && a.every((x, i) => near(x, b[i], abs, rel)) : (typeof b === 'boolean' || typeof b === 'string' ? a === b : Math.abs(a - b) <= Math.max(abs, rel * Math.abs(b)));
const fmt = v => Array.isArray(v) ? '[' + v.join(', ') + ']' : v;

// ---- 1. hashes
lines.push('== 1. input hashes');
const M = readJson('fixtures/MANIFEST.json');
let hashOk = 0; for (const [f, h] of Object.entries(M.files)) { if (sha256(fs.readFileSync(f)) === h) hashOk++; else row(false, 'sha256 ' + f, 'mismatch', h.slice(0, 12)); }
row(hashOk === Object.keys(M.files).length, `sha256 of ${Object.keys(M.files).length} fixture files (MANIFEST.json)`, hashOk, Object.keys(M.files).length);
const PACK_SHA = { 'fixtures/data/run-223455000-224500000/hops.jsonl': '8fdaf24ecda09aa0f17f5b4ddd704d88e83eef7f5f5b0fb75dc2f60ab12ec1c5', 'fixtures/data/intents-223455000-224500000/diffs.jsonl': 'a449630465cad33b143c97a550a10f4ba9d2d906a24ac3ca0f1311991047942a' };
for (const [f, h] of Object.entries(PACK_SHA)) { const got = sha256(readText(f)); row(got === h, 'raw input = pack inputSha256: ' + f.split('/').pop(), got.slice(0, 12), h.slice(0, 12)); }
const PREREG = '751ca84ec592f49058ae6c2499e0a8b18200276bcfc7ddd3014f69c719ae3fe8';
row(sha256(fs.readFileSync('PREREGISTRATION.md')) === PREREG, 'PREREGISTRATION.md sha256 (hashed 2026-11-14 16:17:43 UTC)', sha256(fs.readFileSync('PREREGISTRATION.md')).slice(0, 12), PREREG.slice(0, 12));

// ---- 2. recompute and compare with results/
const R = readJson('results/rhea.json'), I = readJson('results/intents.json'), C = readJson('results/coverage.json');
const rh = analyzeRhea(loadRhea());
const inp = loadIntents(); const it = analyzeIntents(inp); const sens = sensitivity(inp, it.n);
const cov = analyzeCoverage();
const checks = [
  ['Rhea arb gross $/day', rh.original.cyclicArb.grossPerDayUsd, R.original.cyclicArb.grossPerDayUsd],
  ['Rhea arb 95% CI $/day', rh.original.cyclicArb.ci95PerDayUsd, R.original.cyclicArb.ci95PerDayUsd],
  ['Rhea arb bps of priced volume', rh.original.cyclicArb.bpsOfVolume, R.original.cyclicArb.bpsOfVolume],
  ['Rhea priced volume $/day', rh.original.volume.perDayUsd, R.original.volume.perDayUsd],
  ['Rhea ex-spike baseline $/day', rh.extended.robust.exSpikePerDayUsd, R.extended.robust.exSpikePerDayUsd],
  ['Rhea ex-spike 95% CI $/day', rh.extended.robust.exSpikeCI95PerDayUsd, R.extended.robust.exSpikeCI95PerDayUsd],
  ['Rhea spike window share %', rh.extended.robust.spikeSharePct, R.extended.robust.spikeSharePct],
  ['Rhea median window $', rh.extended.robust.medianWindowUsd, R.extended.robust.medianWindowUsd],
  ['Rhea top-3 senders %', rh.original.cyclicArb.top3SharePct, R.original.cyclicArb.top3SharePct],
  ['Rhea top-3 senders ex-spike %', rh.extended.concentration.exSpikeBySender.top3Pct, R.extended.concentration.exSpikeBySender.top3Pct],
  ['Rhea back-run share of profit %', rh.original.backruns.sharePct, R.original.backruns.sharePct],
  ['Rhea strict sandwich candidates', rh.original.sandwiches.strict, R.original.sandwiches.strict],
  ['Rhea arb gas % of gross', rh.original.cyclicArb.gasPctOfGross, R.original.cyclicArb.gasPctOfGross],
  ['Rhea arb % of max issuance', rh.original.issuance.arbPctOfIssuance, R.original.issuance.arbPctOfIssuance],
  ['Rhea markout +60s net $/day', rh.extended.markout.h60.netPerDayUsd, R.extended.markout.h60.netPerDayUsd],
  ['Rhea markout +300s net $/day', rh.extended.markout.h300.netPerDayUsd, R.extended.markout.h300.netPerDayUsd],
  ['Intents solver capture $/day (token_diff)', it.original.perDay.solverCaptureUsd, I.original.perDay.solverCaptureUsd],
  ['Intents solver capture 95% CI', it.original.perDay.solverCaptureCI95, I.original.perDay.solverCaptureCI95],
  ['Intents priced token_diff volume $/day', it.original.perDay.volumeUsd, I.original.perDay.volumeUsd],
  ['Intents solver bps', it.original.bps.solverCapture, I.original.bps.solverCapture],
  ['Intents app-fee bps', it.extended.stack.appFeeBps, I.extended.stack.appFeeBps],
  ['Intents app fees $/day', it.extended.stack.appFeePerDayUsd, I.extended.stack.appFeePerDayUsd],
  ['Intents app fees 95% CI', it.extended.stack.appFeeCI95, I.extended.stack.appFeeCI95],
  ['Intents protocol-fee bps', it.extended.stack.protocolBps, I.extended.stack.protocolBps],
  ['Intents total user cost bps', it.extended.stack.totalBps, I.extended.stack.totalBps],
  ['Intents top swap share of solver capture %', it.extended.fragility.topSwap.sharePctOfSolverCapture, I.extended.fragility.topSwap.sharePctOfSolverCapture],
  ['Intents top-3 solvers %', it.original.solvers.top3SharePct, I.original.solvers.top3SharePct],
  ['Intents outward share % (v4 rule)', it.original.flows.outwardSharePct, I.original.flows.outwardSharePct],
  ['Intents outward share % (omdep fixed)', it.extended.flowsFixedOmdep.outwardSharePct, I.extended.flowsFixedOmdep.outwardSharePct],
  ['Sensitivity: solver bps min..max', [Math.min(...sens.map(s => s.solverBps)), Math.max(...sens.map(s => s.solverBps))], [Math.min(...I.sensitivity.map(s => s.solverBps)), Math.max(...I.sensitivity.map(s => s.solverBps))]],
  ['Sensitivity: app-fee bps min..max', [Math.min(...sens.map(s => s.appFeeBps)), Math.max(...sens.map(s => s.appFeeBps))], [Math.min(...I.sensitivity.map(s => s.appFeeBps)), Math.max(...I.sensitivity.map(s => s.appFeeBps))]],
  ['Coverage: token_diff share of DefiLlama %', cov.reconciliation.tokenDiffShareOfDefillamaPct, C.reconciliation.tokenDiffShareOfDefillamaPct],
  ['Coverage: hub share of range txs %', cov.hub.shareOfRangeTxsPct, C.hub.shareOfRangeTxsPct],
  ['Coverage: hub sent $/day (sample)', cov.hub.sentPerDayUsd, C.hub.sentPerDayUsd],
  ['Coverage: hub sent 95% CI', cov.hub.sentPerDayCI95, C.hub.sentPerDayCI95],
  ['Coverage: sample txs with token_diff %', cov.txKinds.token_diff?.pct ?? 0, C.txKinds.token_diff?.pct ?? 0],
];
if (fs.existsSync('fixtures/chunk-authors.json') && fs.existsSync('results/chunk-producers.json')) {
  const ch = analyzeChunks(), CH = readJson('results/chunk-producers.json');
  checks.push(['Chunk producers T1 Monte Carlo p', ch.T1_vsSchedule.monteCarloP, CH.T1_vsSchedule.monteCarloP], ['Chunk producers T2 permutation p', ch.T2_vsFailedSameSigners.permutationP, CH.T2_vsFailedSameSigners.permutationP], ['Chunk producers T2b (within window) p', ch.T2b_vsFailedSameSigners_withinWindow.permutationP, CH.T2b_vsFailedSameSigners_withinWindow.permutationP]);
}
const hq = fs.existsSync('fixtures/hub-quotes.json.gz') && fs.existsSync('results/hub-quotes.json') ? analyzeHubQuotes() : null;
if (hq) {
  const HQ = readJson('results/hub-quotes.json');
  checks.push(['Treasury path: priced swaps (quotes)', hq.all.quotes, HQ.all.quotes], ['Treasury path: all-in user cost bps', hq.all.totalBps, HQ.all.totalBps], ['Treasury path: all-in 95% CI', hq.all.ci95, HQ.all.ci95],
    ['Treasury path: non-stable pairs bps', hq.other.totalBps, HQ.other.totalBps], ['Treasury path: same-asset cross-chain bps', hq.sameAssetCrossChain.totalBps, HQ.sameAssetCrossChain.totalBps], ['Treasury path: user cost $/day', hq.perDay.userCostUsd, HQ.perDay.userCostUsd]);
}
lines.push('== 2. recomputed from fixtures vs committed results/*.json (tol max(0.01, 1e-6 rel))');
for (const [w, a, b] of checks) row(near(a, b), w, fmt(a), fmt(b));

// ---- 3. reproduce the original pack's published (pre-registered) numbers
lines.push('== 3. reproduced vs the original pack results JSON');
const PACK = [
  ['Rhea cyclic arbs (count)', rh.original.cyclicArb.count, 1652, 0], ['Rhea gross $/day', rh.original.cyclicArb.grossPerDayUsd, 1247.13, 0.005], ['Rhea CI', rh.original.cyclicArb.ci95PerDayUsd, [216.37, 3084.97], 0.005],
  ['Rhea top-3 %', rh.original.cyclicArb.top3SharePct, 50.2, 0], ['Rhea sandwich candidates', rh.original.sandwiches.candidates, 467, 0], ['Rhea strict sandwiches', rh.original.sandwiches.strict, 1, 0],
  ['Rhea volume $/day (tol 0.5%: metadata refetched)', rh.original.volume.perDayUsd, 8092272.54, 0.005 * 8092272.54],
  ['Rhea % of issuance (tol 0.01: median price window fixed)', rh.original.issuance.arbPctOfIssuance, 0.3858, 0.01],
  ['Intents solver $/day', it.original.perDay.solverCaptureUsd, 1107.58, 0.005], ['Intents solver CI', it.original.perDay.solverCaptureCI95, [-101.62, 2528.54], 0.005],
  ['Intents bps user/solver/fees', [it.original.bps.userCost, it.original.bps.solverCapture, it.original.bps.protocolFees], [8.09, 8.07, 0.03], 0.005],
  ['Intents top-3 solvers %', it.original.solvers.top3SharePct, 99.4, 0], ['Intents net NEAR flow/day', it.original.flows.netNearPerDay, -77, 0], ['Intents outward share %', it.original.flows.outwardSharePct, 1.2, 0],
];
for (const [w, a, b, tol] of PACK) row(near(a, b, tol, 0), w, fmt(a), fmt(b), `tol ${tol}`);

// ---- 4. labelled hashes
lines.push('== 4. labelled transactions');
const arb = rh.extended.largestArbs.find(t => t.tx === 'ZNRqvoRqCYiuWHG2LoUJcx95TPQZuzcD1xx7wWbizkr');
row(!!arb && arb.sender === 'walrus1.near' && near(arb.profitUsd, 36.31), 'arb ZNRqvoRq... walrus1.near, 3-hop cycle, profit $', arb?.profitUsd, 36.31);
const sw = rh.original.sandwiches.strictList[0];
row(!!sw && sw.attackerSwaps > 10000 && sw.victim === 'zoe1.near', 'strict sandwich candidate: attacker MM, victim zoe1.near', sw ? `${sw.attackerSwaps} swaps` : 'none', '>10000 swaps', 'rejected on review');
const spikeFirst = rh.extended.spike.routerFirst10[0];
row(spikeFirst.tx === 'CsRY5e4FaKTEEH3pBq1o3EDKEMkoB4zGQgpzNgiGjDT5' && spikeFirst.ok === false && spikeFirst.inUsd === 10000, 'spike: first router clip CsRY5e4F... $10k, failed', `${spikeFirst.inUsd} ok=${spikeFirst.ok}`, '10000 ok=false');
const s1 = it.P.find(s => s.tx === 'FQcNTHHqEErb4m4RhJyc1RrrhjmNnxAyuVh7hon4xNeo');
row(!!s1 && near(s1.volume, 242799, 1) && near(s1.solverV, 455.61) && near(s1.appFee, 243.04), 'swap FQcNTHHq... $242.8k: solver $455.61 + app fee $', s1 && +s1.appFee.toFixed(2), 243.04);
const s2 = it.P.find(s => s.tx === 'FWpiMSDBiiAnhkC5RyVd9buPMfjCFurutRUYY76sFy4t');
row(!!s2 && s2.appFee > 700 && s2.appFee > 10 * s2.solverV, 'swap FWpiMSDB... (1click-swapkit): app fee > 10x solver', s2 && `${s2.appFee.toFixed(0)} vs ${s2.solverV.toFixed(0)}`, '>10x');
if (hq) {
  const q = hq.quotes.find(x => x.acct === 'e464353c94554e0f3a5319600bc8b4f2d8e4736b35ffd4ea7368e886541d8f37');
  row(!!q && q.symA === 'NBTC' && q.symB === 'USDT' && q.withdrew && near(q.totalBps, 21.71), 'quote e464353c... $57k NBTC->USDT via Treasury, all-in bps', q && +q.totalBps.toFixed(2), 21.71);
}
lines.push('');
lines.push(`${pass} passed, ${fail} failed, ${((Date.now() - t0) / 1000).toFixed(1)} s, node ${process.version}, network: none`);
console.log(lines.join('\n'));
process.exit(fail ? 1 : 0);
