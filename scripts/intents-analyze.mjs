// Yuki: NEAR Intents analysis, OFFLINE from fixtures. Writes results/intents.json (original + extended + sensitivity).
// Run (repo root): node --dns-result-order=ipv4first --max-old-space-size=2048 scripts/intents-analyze.mjs [DATADIR]
//   DATADIR defaults to fixtures/data/intents-223455000-224500000 (diffs.jsonl or diffs.jsonl.gz).
import fs from 'node:fs';
import { readText, readJson } from '../lib/io.mjs';
import { analyzeIntents, TOP_MM } from '../lib/intents.mjs';
export function loadIntents(DIR = 'fixtures/data/intents-223455000-224500000') {
  return {
    raw: readText(`${DIR}/diffs.jsonl`), counts: readJson(`${DIR}/counts.json`), meta: readJson(`${DIR}/meta.json`),
    META: readJson('fixtures/intents-meta.json').META, klines: readJson('fixtures/intents-klines.json'),
    events: readJson('fixtures/intents-swap-events.json'),
  };
}
// Solver-rule sensitivity. "curated" removes three non-solver accounts named in the review and adds every account
// whose name contains "solver" (review §1.4); "6247-as-user" reclassifies the top market maker as a user.
export function sensitivity(inp, n) {
  const named = Object.keys(n).filter(a => /solver/.test(a));
  const rules = [
    ['>= 5 entries', { min: 5 }], ['>= 10 entries', { min: 10 }], ['>= 20 entries (pre-registered)', { min: 20 }], ['>= 50 entries', { min: 50 }], ['>= 100 entries', { min: 100 }],
    ['curated by name', { min: 20, remove: ['111-testing-funds.near', 'bestswap.near', 'intents.tg'], add: named }],
    ['top market maker 6247d9... as user', { min: 20, remove: [TOP_MM] }],
  ];
  const out = [];
  for (const [label, rule] of rules) {
    const r = analyzeIntents({ ...inp, solverRule: rule, label });
    out.push({ rule: label, solvers: r.original.solvers.count, pricedSwaps: r.original.sample.pricedSwapsWithSolver, volumePerDayUsd: r.original.perDay.volumeUsd, solverCapturePerDayUsd: r.original.perDay.solverCaptureUsd, solverCI95: r.original.perDay.solverCaptureCI95, solverBps: r.original.bps.solverCapture, appFeeBps: r.extended.stack.appFeeBps, protocolBps: r.extended.stack.protocolBps, totalUserBps: r.extended.stack.totalBps, top3Pct: r.original.solvers.top3SharePct });
  }
  return out;
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const inp = loadIntents(process.argv[2]);
  const r = analyzeIntents(inp);
  const alt = analyzeIntents({ ...inp, feeRule: 'notAnySolver', label: 'review fee rule' });
  const reg = analyzeIntents({ ...inp, registeredOnly: true, label: 'registered pricing only' });
  const res = {
    generatedBy: 'scripts/intents-analyze.mjs', original: r.original, extended: r.extended,
    sensitivity: sensitivity(inp, r.n),
    feeRuleVariant: { rule: 'notAnySolver (receiver not in the global >=20 solver set; the review appfees.mjs rule)', appFeePerDayUsd: alt.extended.stack.appFeePerDayUsd, appFeeBps: alt.extended.stack.appFeeBps, transfers: alt.extended.stack.appFeeTransfers },
    pricingAsRegistered: { note: 'v3 pricing exactly as registered: stables + NEAR/BTC/ETH/SOL only (no ZEC/TRX/BNB/TON). Stables still matched by symbol (contract-id list not in the pack).', pricedSwapsWithSolver: reg.original.sample.pricedSwapsWithSolver, volumePerDayUsd: reg.original.perDay.volumeUsd, solverCapturePerDayUsd: reg.original.perDay.solverCaptureUsd, solverCI95: reg.original.perDay.solverCaptureCI95, solverBps: reg.original.bps.solverCapture, appFeeBps: reg.extended.stack.appFeeBps, protocolBps: reg.extended.stack.protocolBps, top3Pct: reg.original.solvers.top3SharePct, killCriteria: reg.original.killCriteria },
  };
  fs.mkdirSync('results', { recursive: true });
  fs.writeFileSync('results/intents.json', JSON.stringify(res, null, 1));
  console.log('wrote results/intents.json', JSON.stringify({ solver: r.original.perDay, bps: r.original.bps, stack: r.extended.stack }, null, 0));
}
