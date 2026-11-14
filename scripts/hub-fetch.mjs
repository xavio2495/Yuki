// Yuki: ONLINE. Random sample of intents.near transactions from the sampled windows (pack hashes.json), fetched from
// the FastNEAR explorer API, reduced to the intents.near events we use (transfer, token_diff, *_withdraw, mt_mint,
// intents_executed). Also: full-range tx counts for intents.near and the hub 51e8f94d..., hub account/keys facts,
// and ft_metadata for tokens missing from fixtures/intents-meta.json. Read-only; ~35 API calls + metadata calls.
// Run: node --dns-result-order=ipv4first --max-old-space-size=2048 scripts/hub-fetch.mjs PACK_DATA/intents-223455000-224500000/hashes.json [N=600]
// Writes fixtures/hub-sample-events.json.gz and fixtures/hub-facts.json; extends fixtures/intents-meta-extra.json.
import fs from 'node:fs';
import zlib from 'node:zlib';
import { sha256 } from '../lib/io.mjs';
import { HUB } from '../lib/intents.mjs';
const [HF, NS] = process.argv.slice(2); const N = +(NS || 600);
const API = 'https://tx.main.fastnear.com/v0', RPCS = ['https://near.drpc.org', 'https://free.rpc.fastnear.com'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const post = async (p, body) => { for (let a = 0; a < 6; a++) { try { const r = await fetch(API + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); if (r.ok) return r.json(); if (r.status === 429) { await sleep(4000 * (a + 1)); continue; } } catch { } await sleep(2000 * (a + 1)); } return null; };
const rpc = async (method, params) => { for (let a = 0; a < 8; a++) { try { const r = await fetch(RPCS[a % 2], { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) }); if (r.status === 429) { await sleep(1500 * (a + 1)); continue; } const j = await r.json(); if (j.result) return j.result; if (j.error && !/rate|429|timeout/i.test(JSON.stringify(j.error))) return { error: j.error }; } catch { } await sleep(800 * (a + 1)); } return null; };
const view = async (account_id, method_name, args) => { const r = await rpc('query', { request_type: 'call_function', finality: 'final', account_id, method_name, args_base64: Buffer.from(JSON.stringify(args)).toString('base64') }); try { return JSON.parse(Buffer.from(r.result).toString()); } catch { return r?.error ? { error: r.error.cause?.name || r.error.message } : null; } };
const hashesRaw = fs.readFileSync(HF, 'utf8'); const hashes = JSON.parse(hashesRaw);
let seed = 20261114; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const pick = new Set(); while (pick.size < Math.min(N, hashes.length)) pick.add(hashes[Math.floor(rnd() * hashes.length)]);
const list = [...pick]; const out = {};
const KEEP = new Set(['transfer', 'token_diff', 'mt_withdraw', 'ft_withdraw', 'native_withdraw', 'nft_withdraw', 'mt_mint', 'mt_burn', 'intents_executed', 'mt_transfer']);
for (let k = 0; k < list.length; k += 20) {
  const j = await post('/transactions', { tx_hashes: list.slice(k, k + 20) });
  if (!j) { console.error('batch failed', k); continue; }
  for (const tx of j.transactions) {
    if (!tx) continue; const ev = [];
    for (const r of tx.receipts) {
      if (r.receipt.receiver_id !== 'intents.near') continue; const o = r.execution_outcome.outcome; const ok = !!(o.status && ('SuccessValue' in o.status || 'SuccessReceiptId' in o.status));
      for (const l of o.logs) if (l.startsWith('EVENT_JSON:')) { try { const e = JSON.parse(l.slice(11)); if (KEEP.has(e.event)) ev.push({ ok, h: r.execution_outcome.block_height, standard: e.standard, event: e.event, data: e.data }); } catch { } }
    }
    out[tx.transaction.hash] = { signer: tx.transaction.signer_id, h: tx.execution_outcome.block_height, ts: Math.floor(Number(tx.transaction_outcome?.block_timestamp || 0) / 1e6) || null, ev };
  }
  if (k % 100 === 0) console.error('fetched', k + 20, '/', list.length);
  await sleep(1200);
}
// timestamps: FastNEAR returns block timestamps on receipts in some versions; fall back to height-based estimate later
fs.writeFileSync('fixtures/hub-sample-events.json.gz', zlib.gzipSync(JSON.stringify({ fetchedAt: new Date().toISOString(), source: API + '/transactions', hashesFileSha256: sha256(hashesRaw), population: hashes.length, seed: 20261114, requested: list.length, txs: out })));
// facts
const START = 223455000, END = 224500000;
const cnt = async acc => (await post('/account', { account_id: acc, from_tx_block_height: START, to_tx_block_height: END, limit: 1 }))?.txs_count ?? null;
const facts = { fetchedAt: new Date().toISOString(), hub: HUB, range: [START, END] };
facts.txsCountRange = { 'intents.near': await cnt('intents.near'), hub: await cnt(HUB) };
facts.viewAccount = await rpc('query', { request_type: 'view_account', finality: 'final', account_id: HUB });
facts.intentsPublicKeys = await view('intents.near', 'public_keys_of', { account_id: HUB });
const first = await post('/account', { account_id: HUB, limit: 5, desc: false });
facts.oldestTxs = first?.account_txs?.map(t => ({ tx: t.transaction_hash, h: t.tx_block_height, ts: t.tx_block_timestamp, is_signer: t.is_signer, is_event_log: t.is_event_log })) ?? null;
fs.writeFileSync('fixtures/hub-facts.json', JSON.stringify(facts, null, 1));
// metadata for tokens not in the intents fixture
const META = JSON.parse(fs.readFileSync('fixtures/intents-meta.json', 'utf8')).META;
const extraF = 'fixtures/intents-meta-extra.json'; const extra = fs.existsSync(extraF) ? JSON.parse(fs.readFileSync(extraF, 'utf8')).META : {};
const toks = new Set(); for (const t of Object.values(out)) for (const e of t.ev) for (const d of e.data || []) { for (const m of [d.tokens, d.diff, d.fees_collected]) if (m) for (const k of Object.keys(m)) toks.add(k); if (e.event === 'ft_withdraw' && d.token) toks.add('nep141:' + d.token); }
let fetched = 0;
for (const t of toks) { if (t in META || t in extra) continue; if (!t.startsWith('nep141:')) { extra[t] = null; continue; } const m = await view(t.slice(7), 'ft_metadata', {}); extra[t] = m && m.decimals != null ? { symbol: m.symbol, decimals: m.decimals } : null; fetched++; await sleep(150); }
fs.writeFileSync(extraF, JSON.stringify({ fetchedAt: new Date().toISOString(), source: RPCS, META: extra }));
console.error('done txs', Object.keys(out).length, 'extra tokens fetched', fetched, JSON.stringify(facts.txsCountRange));
