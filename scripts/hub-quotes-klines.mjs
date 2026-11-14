// Yuki: ONLINE. Binance 1-minute closes for tokens that the base Intents pricing leaves unpriced in the Treasury-path
// quotes (XRP, LTC, POL, SUI, PEPE, SHIB, BCH, PENGU, DOGE), plus USDCUSDT so USDC can be priced at market instead of $1.
// Covers the span of release timestamps in fixtures/hub-quotes.json.gz. Read-only (data-api.binance.vision).
// Run: node --dns-result-order=ipv4first --max-old-space-size=2048 scripts/hub-quotes-klines.mjs   -> fixtures/hub-quotes-klines.json
import fs from 'node:fs';
import { readJson } from '../lib/io.mjs';
const SYMS = ['XRPUSDT', 'LTCUSDT', 'POLUSDT', 'SUIUSDT', 'PEPEUSDT', 'SHIBUSDT', 'BCHUSDT', 'PENGUUSDT', 'DOGEUSDT', 'USDCUSDT'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const Q = readJson('fixtures/hub-quotes.json');
const ts = Object.values(Q.accounts).flatMap(a => a.txs.map(t => t.ts)).filter(Boolean);
const t0 = Math.floor(Math.min(...ts) / 60000) * 60000 - 120000, t1 = Math.max(...ts) + 120000;
const out = { fetchedAt: new Date().toISOString(), source: 'https://data-api.binance.vision/api/v3/klines interval=1m close', span: [t0, t1] };
for (const sym of SYMS) {
  const rows = [];
  for (let s = t0; s < t1; ) {
    let j = null;
    for (let a = 0; a < 5; a++) { try { const r = await fetch(`https://data-api.binance.vision/api/v3/klines?symbol=${sym}&interval=1m&startTime=${s}&limit=1000`); j = await r.json(); if (Array.isArray(j)) break; } catch { } await sleep(1000 * (a + 1)); }
    if (!Array.isArray(j) || !j.length) break;
    for (const k of j) if (k[0] <= t1) rows.push([k[0], +k[4]]);
    s = j[j.length - 1][0] + 60000; await sleep(250);
  }
  out[sym] = rows; console.error(sym, rows.length);
}
fs.writeFileSync('fixtures/hub-quotes-klines.json', JSON.stringify(out));
