// Yuki collector (unchanged logic from the pack): every executed Rhea swap (Ref v2 + DCL) in a FIXED block range, at receipt level.
// Source: FastNEAR transaction explorer API (public, keyless): /v0/account lists every tx touching an account
// (as signer, receiver, or any receipt), /v0/transactions returns the tx with all receipt outcomes and logs.
// Swaps are parsed from LOGS, so multi-hop, DCL `pool_ids`, and contract-originated swaps are all included.
// Each hop records the receipt's execution block height and outcome index (execution order within the block).
// Resumable: phase A writes hashes, phase B appends hops; rerun continues where it stopped. Read-only.
// Output DATADIR then feeds scripts/build-fixtures.mjs and the analysers. Example: DATADIR=data/run-223455000-224500000
// Run: node --dns-result-order=ipv4first --max-old-space-size=2048 scripts/rhea-swaps.mjs START END OUTDIR [WINDOWS BLOCKS]
//   With WINDOWS and BLOCKS: a systematic sample of WINDOWS evenly spaced windows of BLOCKS consecutive blocks in [START, END]
//   (contiguous inside each window, so ordering analysis is valid there); full-range tx counts are recorded for scaling.
const [START, END] = process.argv.slice(2, 4).map(Number); const OUT = process.argv[4];
const [WINDOWS, BLOCKS] = process.argv.slice(5, 7).map(Number);
const ranges = WINDOWS ? Array.from({ length: WINDOWS }, (_, i) => { const s = START + Math.floor(i * (END - START + 1) / WINDOWS); return [s, s + BLOCKS - 1]; }) : [[START, END]];
if (!START || !END || !OUT) { console.error('usage: START END OUTDIR'); process.exit(2); }
import fs from 'node:fs';
fs.mkdirSync(OUT, { recursive: true });
const API = 'https://tx.main.fastnear.com/v0';
const DEX = { 'v2.ref-finance.near': 'ref', 'dclv2.ref-labs.near': 'dcl' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const post = async (p, body) => { for (let a = 0; a < 8; a++) { try { const r = await fetch(API + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); if (r.ok) return r.json(); if (r.status === 400) throw new Error('400 ' + p); } catch (e) { if (String(e).includes('400')) throw e; } await sleep(1000 * 2 ** Math.min(a, 5)); } throw new Error('failed ' + p); };
const log = (...x) => console.error(new Date().toISOString().slice(11, 19), ...x);

// ---- phase A: hashes
const hashFile = `${OUT}/hashes.json`;
let hashes;
if (fs.existsSync(hashFile)) hashes = JSON.parse(fs.readFileSync(hashFile));
else {
  const set = new Map();
  const counts = { fullRange: {}, windows: [] };
  for (const acc of Object.keys(DEX)) counts.fullRange[acc] = (await post('/account', { account_id: acc, from_tx_block_height: START, to_tx_block_height: END, limit: 1 })).txs_count;
  for (const [a, b] of ranges) {
    const wc = { from: a, to: b };
    for (const acc of Object.keys(DEX)) {
      let token = null, n = 0;
      for (;;) {
        const j = await post('/account', token ? { account_id: acc, from_tx_block_height: a, to_tx_block_height: b, resume_token: token } : { account_id: acc, from_tx_block_height: a, to_tx_block_height: b });
        for (const t of j.account_txs) { set.set(t.transaction_hash, t.tx_block_height); n++; }
        if (!j.resume_token || !j.account_txs.length) break;
        token = j.resume_token;
      }
      wc[acc] = n;
    }
    counts.windows.push(wc);
    if (counts.windows.length % 10 === 0) log('windows listed', counts.windows.length, '/', ranges.length, 'txs', set.size);
  }
  fs.writeFileSync(`${OUT}/counts.json`, JSON.stringify(counts, null, 1));
  hashes = [...set.entries()].sort((a, b) => a[1] - b[1]).map(x => x[0]);
  fs.writeFileSync(hashFile, JSON.stringify(hashes));
}
log('hashes', hashes.length);

// ---- phase B: transactions -> hops
const hopFile = `${OUT}/hops.jsonl`, doneFile = `${OUT}/done-batches.txt`;
const done = new Set(fs.existsSync(doneFile) ? fs.readFileSync(doneFile, 'utf8').split('\n').filter(Boolean).map(Number) : []);
const refLine = /^Swapped (\d+) ([^\s,]+) for (\d+) ([^\s,]+)/;
const args64 = s => { try { return Buffer.from(s, 'base64').toString(); } catch { return ''; } };
function hopsOf(tx) {
  const t = tx.transaction, out = [];
  let burnt = BigInt(tx.execution_outcome.outcome.tokens_burnt || 0);
  for (const r of tx.receipts) burnt += BigInt(r.execution_outcome.outcome.tokens_burnt || 0);
  for (const r of tx.receipts) {
    const kind = DEX[r.receipt.receiver_id]; if (!kind) continue;
    const eo = r.execution_outcome, o = eo.outcome, act = r.receipt.receipt?.Action; if (!act) continue;
    const fcs = (act.actions || []).filter(x => x.FunctionCall).map(x => ({ m: x.FunctionCall.method_name, a: args64(x.FunctionCall.args) }));
    let sender = act.signer_id; for (const f of fcs) { try { const j = JSON.parse(f.a); if (j.sender_id) sender = j.sender_id; } catch {} }
    const base = { tx: t.hash, txh: tx.execution_outcome.block_height, signer: t.signer_id, txrecv: t.receiver_id, dex: kind, h: eo.block_height, ts: Math.round(eo.block_timestamp / 1e6), idx: eo.index, rid: eo.id, pred: r.receipt.predecessor_id, sender, method: fcs[0]?.m, burnt: burnt.toString(), ok: !!(o.status && ('SuccessValue' in o.status || 'SuccessReceiptId' in o.status)) };
    const hs = [];
    for (const l of o.logs) {
      if (kind === 'ref') { const m = l.match(refLine); if (m) hs.push({ ...base, tin: m[2], ain: m[1], tout: m[4], aout: m[3] }); }
      else if (l.startsWith('EVENT_JSON:')) { try { const e = JSON.parse(l.slice(11)); if (e.standard === 'dcl.ref' && e.event === 'swap') for (const d of e.data) if (d.amount_in !== '0') hs.push({ ...base, pool: d.pool_id, tin: d.token_in, ain: d.amount_in, tout: d.token_out, aout: d.amount_out, fee: d.total_fee, sender: d.swapper || sender }); } catch {} }
    }
    if (kind === 'ref' && hs.length) {
      const ids = [...fcs.map(f => f.a).join(' ').replace(/\\"/g, '"').matchAll(/"pool_id"\s*:\s*"?(\d+)"?/g)].map(m => m[1]);
      hs.forEach((x, i) => { x.pool = ids.length === hs.length ? 'ref:' + ids[i] : `refpair:${[x.tin, x.tout].sort().join('/')}`; });
    }
    hs.forEach((x, i) => { x.hop = i; });
    out.push(...hs);
  }
  return out;
}
const B = 20, batches = Math.ceil(hashes.length / B);
let next = 0, nhops = 0, failed = 0;
const w = fs.createWriteStream(hopFile, { flags: 'a' }), d = fs.createWriteStream(doneFile, { flags: 'a' });
await Promise.all(Array.from({ length: 4 }, async () => {
  while (next < batches) {
    const k = next++; if (done.has(k)) continue;
    try {
      const j = await post('/transactions', { tx_hashes: hashes.slice(k * B, k * B + B) });
      let s = ''; for (const tx of j.transactions) { if (!tx) continue; for (const h of hopsOf(tx)) { s += JSON.stringify(h) + '\n'; nhops++; } }
      w.write(s); d.write(k + '\n');
    } catch (e) { failed++; }
    if (k % 500 === 0) log('batch', k, '/', batches, 'hops', nhops, 'failed', failed);
  }
}));
w.end(); d.end();
fs.writeFileSync(`${OUT}/meta.json`, JSON.stringify({ source: API, start: START, end: END, windows: WINDOWS || null, blocksPerWindow: BLOCKS || null, txs: hashes.length, batches, failedBatches: failed, finishedAt: new Date().toISOString() }, null, 1));
log('done hops', nhops, 'failed batches', failed, '(rerun to retry)');
