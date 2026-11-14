// Yuki: ONLINE. Full public lifecycle of quotes routed through 51e8f94d... (Private PoA Bridge Treasury). The frame is every
// implicit (hex) account that sends a transfer to the hub inside fixtures/hub-sample-events.json.gz (a random tx sample
// of the 168 windows). Each such account is a per-quote account: deposit (mt_mint) -> transfer to the Treasury (shield)
// -> the Treasury releases the output back (unshield) -> withdraw. For each account, all its txs within +-20,000 blocks of the sampled tx are fetched from the
// FastNEAR explorer API and reduced to intents.near events. Read-only; ~334 /account calls + ~70 /transactions calls.
// Run: node --dns-result-order=ipv4first --max-old-space-size=2048 scripts/hub-quotes-fetch.mjs   -> fixtures/hub-quotes.json.gz
import fs from 'node:fs';
import zlib from 'node:zlib';
import { HUB, TOP_MM } from '../lib/intents.mjs';
const API = 'https://tx.main.fastnear.com/v0', SPAN = 20000;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const post = async (p, body) => { for (let a = 0; a < 8; a++) { try { const r = await fetch(API + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); if (r.ok) return r.json(); if (r.status === 429) { await sleep(5000 * (a + 1)); continue; } } catch { } await sleep(2000 * (a + 1)); } return null; };
const S = JSON.parse(zlib.gunzipSync(fs.readFileSync('fixtures/hub-sample-events.json.gz')));
const frame = new Map();
for (const [hash, t] of Object.entries(S.txs)) for (const e of t.ev) if (e.ok && e.event === 'transfer') for (const d of e.data)
  if (d.receiver_id === HUB && /^[0-9a-f]{64}$/.test(d.account_id) && d.account_id !== TOP_MM) frame.set(d.account_id, { sampledTx: hash, h: t.h });
const accounts = {}; const need = new Set(); let k = 0;
for (const [acct, f] of frame) {
  const j = await post('/account', { account_id: acct, from_tx_block_height: f.h - SPAN, to_tx_block_height: f.h + SPAN, limit: 200 });
  accounts[acct] = { ...f, ok: !!j, txsCount: j?.txs_count ?? null, txs: (j?.account_txs || []).map(x => ({ tx: x.transaction_hash, h: x.tx_block_height, ts: Math.floor(Number(x.tx_block_timestamp) / 1e6) })) };
  for (const x of accounts[acct].txs) need.add(x.tx);
  if (++k % 25 === 0) console.error('accounts', k, '/', frame.size);
  await sleep(700);
}
const txs = {}; const list = [...need];
for (let i = 0; i < list.length; i += 20) {
  const j = await post('/transactions', { tx_hashes: list.slice(i, i + 20) });
  if (!j) { console.error('batch failed', i); continue; }
  for (const tx of j.transactions) {
    if (!tx) continue; const ev = [];
    for (const r of tx.receipts) {
      if (r.receipt.receiver_id !== 'intents.near') continue; const o = r.execution_outcome.outcome; const ok = !!(o.status && ('SuccessValue' in o.status || 'SuccessReceiptId' in o.status));
      for (const l of o.logs) if (l.startsWith('EVENT_JSON:')) { try { const e = JSON.parse(l.slice(11)); ev.push({ ok, h: r.execution_outcome.block_height, standard: e.standard, event: e.event, data: e.data }); } catch { } }
    }
    txs[tx.transaction.hash] = { signer: tx.transaction.signer_id, h: tx.execution_outcome.block_height, ev };
  }
  if (i % 200 === 0) console.error('txs', i + 20, '/', list.length);
  await sleep(1200);
}
fs.writeFileSync('fixtures/hub-quotes.json.gz', zlib.gzipSync(JSON.stringify({ fetchedAt: new Date().toISOString(), source: API, frame: 'hex senders to hub in fixtures/hub-sample-events.json.gz', span: SPAN, accounts, txs })));
console.error('done accounts', Object.keys(accounts).length, 'failed', Object.values(accounts).filter(a => !a.ok).length, 'txs', Object.keys(txs).length, '/', list.length);
