// Yuki: ONLINE step that builds the offline fixtures (token metadata + Binance 1m closes) used by every analysis script.
// Read-only public APIs: NEAR RPC (near.drpc.org, free.rpc.fastnear.com; backs off on 429) and data-api.binance.vision.
// Run (from the repo root):
//   node --dns-result-order=ipv4first --max-old-space-size=2048 scripts/build-fixtures.mjs rhea    DATA_DIR/run-223455000-224500000
//   node --dns-result-order=ipv4first --max-old-space-size=2048 scripts/build-fixtures.mjs intents DATA_DIR/intents-223455000-224500000
// Writes fixtures/rhea-decimals.json + fixtures/rhea-klines.json, or fixtures/intents-meta.json + fixtures/intents-klines.json.
// Klines are fetched with exactly the loop of the original analysers, so the bootstrap and medians reproduce.
import fs from 'node:fs';
import { readLines } from '../lib/io.mjs';
const [what, DIR] = process.argv.slice(2);
const RPCS = ['https://near.drpc.org', 'https://free.rpc.fastnear.com'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function rpc(method, params) {
  for (let a = 0; a < 10; a++) {
    try {
      const r = await fetch(RPCS[a % RPCS.length], { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
      if (r.status === 429) { await sleep(1500 * (a + 1)); continue; }
      const j = await r.json();
      if (j.result) return j.result;
      if (j.error && !/rate|429|timeout/i.test(JSON.stringify(j.error))) return null;
    } catch { }
    await sleep(700 * (a + 1));
  }
  return null;
}
async function ftMeta(account) {
  const r = await rpc('query', { request_type: 'call_function', finality: 'final', account_id: account, method_name: 'ft_metadata', args_base64: '' });
  try { return JSON.parse(Buffer.from(r.result).toString()); } catch { return null; }
}
async function klines(sym, t0, t1, padEnd) {
  const out = [];
  for (let s = Math.floor(t0 / 60000) * 60000 - 60000; s <= t1 + padEnd; s += 1000 * 60000) {
    let j;
    for (let a = 0; a < 5; a++) { try { const r = await fetch(`https://data-api.binance.vision/api/v3/klines?symbol=${sym}&interval=1m&startTime=${s}&limit=1000`); j = await r.json(); if (Array.isArray(j)) break; } catch { } await sleep(1000 * (a + 1)); }
    if (!Array.isArray(j)) { console.error('kline fetch failed', sym, s); continue; }
    for (const k of j) out.push([k[0], +k[4]]);
    await sleep(250);
  }
  return out;
}
fs.mkdirSync('fixtures', { recursive: true });
if (what === 'rhea') {
  const hops = readLines(`${DIR}/hops.jsonl`).filter(x => x.ok).map(x => ({ ...x, tin: x.tin.replace(/,$/, ''), tout: x.tout.replace(/,$/, '') }));
  const tokens = [...new Set(hops.flatMap(x => [x.tin, x.tout]))].sort();
  const DEC = {};
  let i = 0;
  for (const t of tokens) { const m = await ftMeta(t); DEC[t] = m ? m.decimals : null; if (++i % 50 === 0) console.error('meta', i, '/', tokens.length); await sleep(150); }
  fs.writeFileSync('fixtures/rhea-decimals.json', JSON.stringify({ fetchedAt: new Date().toISOString(), source: RPCS, decimals: DEC }, null, 0));
  const t0 = Math.min(...hops.map(x => x.ts)), t1 = Math.max(...hops.map(x => x.ts));
  const k = await klines('NEARUSDT', t0, t1, 120000);
  fs.writeFileSync('fixtures/rhea-klines.json', JSON.stringify({ fetchedAt: new Date().toISOString(), source: 'https://data-api.binance.vision/api/v3/klines interval=1m close', NEARUSDT: k }));
  console.error('rhea fixtures: tokens', tokens.length, 'null decimals', Object.values(DEC).filter(v => v == null).length, 'klines', k.length);
} else if (what === 'intents') {
  const rows = readLines(`${DIR}/diffs.jsonl`).filter(x => x.ok);
  const tokens = [...new Set(rows.flatMap(x => [...Object.keys(x.diff), ...Object.keys(x.fees)]))].sort();
  const META = {};
  for (const t of tokens) { if (!t.startsWith('nep141:')) { META[t] = null; continue; } const m = await ftMeta(t.slice(7)); META[t] = m ? { symbol: m.symbol, decimals: m.decimals } : null; await sleep(150); }
  fs.writeFileSync('fixtures/intents-meta.json', JSON.stringify({ fetchedAt: new Date().toISOString(), source: RPCS, META }));
  const t0 = Math.min(...rows.map(x => x.ts)), t1 = Math.max(...rows.map(x => x.ts));
  const px = { fetchedAt: new Date().toISOString(), source: 'https://data-api.binance.vision/api/v3/klines interval=1m close' };
  for (const sym of ['NEARUSDT', 'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'ZECUSDT', 'TRXUSDT', 'BNBUSDT', 'TONUSDT']) px[sym] = await klines(sym, t0, t1, 60000);
  fs.writeFileSync('fixtures/intents-klines.json', JSON.stringify(px));
} else { console.error('usage: build-fixtures.mjs rhea|intents DATADIR'); process.exit(2); }
