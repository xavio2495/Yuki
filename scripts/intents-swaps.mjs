// Yuki collector (unchanged logic from the pack): every executed NEAR Intents swap (dip4 token_diff events on intents.near) in a FIXED block
// range, sampled systematically like rhea-swaps.mjs. Each token_diff entry = one signer's side of a swap: account_id, the
// per-token diff, fees_collected (protocol fee) and referral. Source: FastNEAR explorer API (public, keyless).
// Resumable. Read-only. Output: OUTDIR/diffs.jsonl (one line per token_diff entry), counts.json, meta.json.
// Output DATADIR then feeds scripts/build-fixtures.mjs and the analysers. Example: DATADIR=data/run-223455000-224500000
// Run: node --dns-result-order=ipv4first --max-old-space-size=2048 scripts/intents-swaps.mjs START END OUTDIR WINDOWS BLOCKS
import fs from 'node:fs';
const [START, END] = process.argv.slice(2, 4).map(Number); const OUT = process.argv[4];
const [WINDOWS, BLOCKS] = process.argv.slice(5, 7).map(Number);
if (!START || !END || !OUT || !WINDOWS || !BLOCKS) { console.error('usage: START END OUTDIR WINDOWS BLOCKS'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });
const API = 'https://tx.main.fastnear.com/v0', ACC = 'intents.near';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const post = async (p, body) => { for (let a = 0; a < 8; a++) { try { const r = await fetch(API + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); if (r.ok) return r.json(); if (r.status === 400) throw new Error('400 ' + p); } catch (e) { if (String(e).includes('400')) throw e; } await sleep(1000 * 2 ** Math.min(a, 5)); } throw new Error('failed ' + p); };
const log = (...x) => console.error(new Date().toISOString().slice(11, 19), ...x);
const ranges = Array.from({ length: WINDOWS }, (_, i) => { const s = START + Math.floor(i * (END - START + 1) / WINDOWS); return [s, s + BLOCKS - 1]; });

const hashFile = `${OUT}/hashes.json`;
let hashes;
if (fs.existsSync(hashFile)) hashes = JSON.parse(fs.readFileSync(hashFile));
else {
  const set = new Map(); const counts = { fullRange: (await post('/account', { account_id: ACC, from_tx_block_height: START, to_tx_block_height: END, limit: 1 })).txs_count, windows: [] };
  for (const [a, b] of ranges) {
    let token = null, n = 0;
    for (;;) {
      const j = await post('/account', token ? { account_id: ACC, from_tx_block_height: a, to_tx_block_height: b, resume_token: token } : { account_id: ACC, from_tx_block_height: a, to_tx_block_height: b });
      for (const t of j.account_txs) { set.set(t.transaction_hash, t.tx_block_height); n++; }
      if (!j.resume_token || !j.account_txs.length) break;
      token = j.resume_token;
    }
    counts.windows.push({ from: a, to: b, txs: n });
    if (counts.windows.length % 10 === 0) log('windows listed', counts.windows.length, '/', ranges.length, 'txs', set.size);
  }
  fs.writeFileSync(`${OUT}/counts.json`, JSON.stringify(counts, null, 1));
  hashes = [...set.entries()].sort((x, y) => x[1] - y[1]).map(x => x[0]);
  fs.writeFileSync(hashFile, JSON.stringify(hashes));
}
log('hashes', hashes.length);

const outFile = `${OUT}/diffs.jsonl`, doneFile = `${OUT}/done-batches.txt`;
const done = new Set(fs.existsSync(doneFile) ? fs.readFileSync(doneFile, 'utf8').split('\n').filter(Boolean).map(Number) : []);
const B = 20, batches = Math.ceil(hashes.length / B);
let next = 0, n = 0, failed = 0;
const w = fs.createWriteStream(outFile, { flags: 'a' }), d = fs.createWriteStream(doneFile, { flags: 'a' });
await Promise.all(Array.from({ length: 4 }, async () => {
  while (next < batches) {
    const k = next++; if (done.has(k)) continue;
    try {
      const j = await post('/transactions', { tx_hashes: hashes.slice(k * B, k * B + B) });
      let s = '';
      for (const tx of j.transactions) {
        if (!tx) continue;
        for (const r of tx.receipts) {
          if (r.receipt.receiver_id !== ACC) continue;
          const eo = r.execution_outcome, o = eo.outcome;
          const ok = !!(o.status && ('SuccessValue' in o.status || 'SuccessReceiptId' in o.status));
          for (const l of o.logs) {
            if (!l.startsWith('EVENT_JSON:')) continue;
            let e; try { e = JSON.parse(l.slice(11)); } catch { continue; }
            if (e.event !== 'token_diff') continue;
            for (const x of e.data) { s += JSON.stringify({ tx: tx.transaction.hash, signer: tx.transaction.signer_id, h: eo.block_height, ts: Math.round(eo.block_timestamp / 1e6), idx: eo.index, ok, intent: x.intent_hash, acct: x.account_id, diff: x.diff, fees: x.fees_collected || {}, ref: x.referral || null }) + '\n'; n++; }
          }
        }
      }
      w.write(s); d.write(k + '\n');
    } catch { failed++; }
    if (k % 500 === 0) log('batch', k, '/', batches, 'diffs', n, 'failed', failed);
  }
}));
w.end(); d.end();
fs.writeFileSync(`${OUT}/meta.json`, JSON.stringify({ source: API, account: ACC, start: START, end: END, windows: WINDOWS, blocksPerWindow: BLOCKS, txs: hashes.length, batches, failedBatches: failed, finishedAt: new Date().toISOString() }, null, 1));
log('done diffs', n, 'failed batches', failed, '(rerun to retry)');
