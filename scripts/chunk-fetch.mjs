// Yuki: ONLINE (optional test, review item 9). For winning Rhea back-runs, a comparator of failed arbitrage attempts by
// the same bot signers, and uniformly random heights in the sampled windows, fetch the author (chunk producer) of
//   (a) the chunk that INCLUDED the bot's transaction (signer's shard at the tx block height), and
//   (b) the chunk on the pool contract's shard at the receipt execution height.
// Source: archival NEAR RPC near.drpc.org (`chunk`, `EXPERIMENTAL_protocol_config`). Read-only, ~1.5k calls, 3 in flight.
// Run: node --dns-result-order=ipv4first --max-old-space-size=2048 scripts/chunk-fetch.mjs   (after scripts/rhea-analyze.mjs)
// Limit: near.drpc.org only serves recent blocks (on 2026-11-14 ~16:30 UTC the oldest available was ~224,351,686), so the
// test is restricted to heights >= CUT (default 224360000): the last ~23 of 168 windows, which include the spike window.
// Writes fixtures/chunk-authors.json.
import fs from 'node:fs';
import { readJson } from '../lib/io.mjs';
import { shardOf } from '../lib/shards.mjs';
const RPC = 'https://near.drpc.org';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rpc = async (method, params) => { for (let a = 0; a < 8; a++) { try { const r = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) }); if (r.status === 429) { await sleep(2000 * (a + 1)); continue; } const j = await r.json(); if (j.result) return j.result; if (j.error && !/rate|429|timeout|busy/i.test(JSON.stringify(j.error))) return { error: j.error.cause?.name || j.error.message }; } catch { } await sleep(1000 * (a + 1)); } return null; };
const all = readJson('results/rhea-winning-backruns.json');
const winningBackruns = all.winningBackruns.filter(b => b.txh >= +(process.argv[2] || 224360000)), failedAttempts = all.failedAttempts.filter(b => b.txh >= +(process.argv[2] || 224360000));
const counts = readJson('fixtures/data/run-223455000-224500000/counts.json');
const CUT = +(process.argv[2] || 224360000);
const layouts = {};
for (const h of [224412990, 224500000]) { const c = await rpc('EXPERIMENTAL_protocol_config', { block_id: h }); layouts[h] = c.shard_layout; }
const layout = layouts[224412990];
const sameLayout = JSON.stringify(layouts[224412990]) === JSON.stringify(layouts[224500000]);
const POOL_ACCT = p => p.startsWith('dcl') || p.includes('|') ? 'dclv2.ref-labs.near' : 'v2.ref-finance.near';
let seed = 99; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const winSigners = new Set(winningBackruns.map(b => b.signer));
const pool = failedAttempts.filter(f => winSigners.has(f.signer));
const fail = []; const used = new Set(); while (fail.length < Math.min(500, pool.length)) { const i = Math.floor(rnd() * pool.length); if (!used.has(i)) { used.add(i); fail.push(pool[i]); } }
const W = counts.windows.filter(w => w.from >= CUT); const rand = []; for (let i = 0; i < 150; i++) { const w = W[Math.floor(rnd() * W.length)]; rand.push(w.from + Math.floor(rnd() * 600)); }
const want = new Map(); const key = (h, s) => h + ':' + s;
const items = [];
for (const [group, list] of [['win', winningBackruns], ['fail', fail]]) for (const b of list) {
  const incl = [b.txh, shardOf(layout, b.signer)], exec = [b.h, shardOf(layout, POOL_ACCT(b.pool))];
  items.push({ group, tx: b.tx, signer: b.signer, incl: key(...incl), exec: key(...exec) }); want.set(key(...incl), incl); want.set(key(...exec), exec);
}
const shardsUsed = [...new Set([...want.values()].map(x => x[1]))];
for (const h of rand) for (const s of shardsUsed) { want.set(key(h, s), [h, s]); }
items.push(...rand.map(h => ({ group: 'random', h })));
console.error('chunks to fetch', want.size, 'shards', shardsUsed, 'sameLayout', sameLayout);
const out = fs.existsSync('fixtures/chunk-authors.json') ? readJson('fixtures/chunk-authors.json').chunks : {};
const todo = [...want.entries()].filter(([k]) => !(k in out));
let done = 0;
async function worker() { while (todo.length) { const [k, [h, s]] = todo.shift(); const r = await rpc('chunk', { block_id: h, shard_id: s }); out[k] = r?.header ? { author: r.author, hc: r.header.height_created, hi: r.header.height_included } : { error: r?.error || 'null' }; if (++done % 200 === 0) { console.error('chunks', done); fs.writeFileSync('fixtures/chunk-authors.json', JSON.stringify({ chunks: out })); } await sleep(120); } }
await Promise.all([worker(), worker(), worker()]);
fs.writeFileSync('fixtures/chunk-authors.json', JSON.stringify({ fetchedAt: new Date().toISOString(), source: RPC + ' chunk', shardLayout: layout, sameLayoutAtRangeEnds: sameLayout, items, chunks: out }));
console.error('done', Object.keys(out).length, 'errors', Object.values(out).filter(x => x.error).length);
