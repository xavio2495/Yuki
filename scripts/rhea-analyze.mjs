// Yuki: Rhea (Ref v2 + DCL) arbitrage / back-run / sandwich analysis, OFFLINE from fixtures. Writes results/rhea.json
// and results/rhea-winning-backruns.json (input of the optional chunk-producer test).
// Run (repo root): node --dns-result-order=ipv4first --max-old-space-size=2048 scripts/rhea-analyze.mjs [DATADIR]
//   DATADIR defaults to fixtures/data/run-223455000-224500000 (hops.jsonl or hops.jsonl.gz).
import fs from 'node:fs';
import { readText, readJson } from '../lib/io.mjs';
import { analyzeRhea } from '../lib/rhea.mjs';
export function loadRhea(DIR = 'fixtures/data/run-223455000-224500000') {
  return { raw: readText(`${DIR}/hops.jsonl`), counts: readJson(`${DIR}/counts.json`), meta: readJson(`${DIR}/meta.json`), decimals: readJson('fixtures/rhea-decimals.json').decimals, klines: readJson('fixtures/rhea-klines.json').NEARUSDT };
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const r = analyzeRhea(loadRhea(process.argv[2]));
  fs.mkdirSync('results', { recursive: true });
  fs.writeFileSync('results/rhea.json', JSON.stringify({ generatedBy: 'scripts/rhea-analyze.mjs', original: r.original, extended: r.extended }, null, 1));
  fs.writeFileSync('results/rhea-winning-backruns.json', JSON.stringify({ winningBackruns: r.winningBackruns, failedAttempts: r.failedAttempts }));
  console.log('wrote results/rhea.json', JSON.stringify({ cyclicArb: { ...r.original.cyclicArb, topSenders: undefined }, robust: r.extended.robust }));
}
