// Yuki: ONLINE. For every tx in an Intents diffs.jsonl, fetch its intents.near events (transfer, token_diff, *_withdraw)
// from the FastNEAR explorer API. Adapted from the blind review's work/fetchswaps.mjs (paths parameterised). Resumable.
// Run: node --dns-result-order=ipv4first --max-old-space-size=2048 scripts/intents-fetch-events.mjs DATADIR/diffs.jsonl fixtures/intents-swap-events.json
// (the committed fixture is the gzip of that output: gzip -9 fixtures/intents-swap-events.json)
import fs from 'node:fs';
import { readLines } from '../lib/io.mjs';
const [IN, OUT] = process.argv.slice(2);
const rows = readLines(IN.replace(/\.gz$/, '')).filter(x => x.ok);
const txs = [...new Set(rows.map(x => x.tx))];
const out = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
const todo = txs.filter(t => !out[t]);
console.error('txs', txs.length, 'todo', todo.length);
for (let k = 0; k < todo.length; k += 20) {
  let j; for (let a = 0; a < 5; a++) { try { const r = await fetch('https://tx.main.fastnear.com/v0/transactions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tx_hashes: todo.slice(k, k + 20) }) }); if (r.ok) { j = await r.json(); break; } } catch { } await new Promise(r => setTimeout(r, 3000 * (a + 1))); }
  if (!j) continue;
  for (const tx of j.transactions) { if (!tx) continue; const ev = [];
    for (const r of tx.receipts) { if (r.receipt.receiver_id !== 'intents.near') continue; const o = r.execution_outcome.outcome; const ok = !!(o.status && ('SuccessValue' in o.status || 'SuccessReceiptId' in o.status));
      for (const l of o.logs) if (l.startsWith('EVENT_JSON:')) { try { const e = JSON.parse(l.slice(11)); if (['transfer', 'token_diff', 'ft_withdraw', 'mt_withdraw', 'native_withdraw'].includes(e.event)) ev.push({ ok, event: e.event, data: e.data }); } catch { } } }
    out[tx.transaction.hash] = ev; }
  if (k % 200 === 0) fs.writeFileSync(OUT, JSON.stringify(out));
  await new Promise(r => setTimeout(r, 1000));
}
fs.writeFileSync(OUT, JSON.stringify(out)); console.error('done', Object.keys(out).length);
