// Yuki: ONLINE. NEAR balances of the buyback and revenue wallets at two blocks ~30 days apart, with the blocks'
// timestamps, so the model can measure NEAR accumulated per day on chain (independent of any price or label).
// Read-only archival RPC (rotates endpoints, backs off on 429). Run:
//   node --dns-result-order=ipv4first --max-old-space-size=2048 scripts/wallets-fetch.mjs [FROM_HEIGHT]
// Writes fixtures/buyback-wallets.json.
import fs from 'node:fs';
const RPCS = ['https://archival-rpc.mainnet.fastnear.com', 'https://archival-rpc.mainnet.near.org', 'https://free.rpc.fastnear.com'];
const WALLETS = ['buybacks.multisignature.near', 'fefundsadmin.sputnik-dao.near', '1csfundsadmin.sputnik-dao.near'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
let calls = 0;
async function rpc(method, params) {
  for (let a = 0; a < 12; a++) {
    const url = RPCS[(calls++ + a) % RPCS.length];
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
      const j = await r.json().catch(() => null);
      if (j?.result) return j.result;
    } catch { }
    await sleep(1500 * (a + 1));
  }
  throw new Error(`${method} failed`);
}
const head = await rpc('block', { finality: 'final' });
const toH = head.header.height;
const fromH = +(process.argv[2] || toH - 4_470_000);
const from = await rpc('block', { block_id: fromH });
const out = { fetchedAt: new Date().toISOString(), source: RPCS, blocks: { from: { height: from.header.height, timestampNs: from.header.timestamp_nanosec }, to: { height: toH, timestampNs: head.header.timestamp_nanosec } }, totalSupplyNearAtTo: Number(BigInt(head.header.total_supply) / 10n ** 21n) / 1e3, wallets: {} };
for (const w of WALLETS) {
  const a = await rpc('query', { request_type: 'view_account', block_id: from.header.height, account_id: w }).catch(() => null);
  const b = await rpc('query', { request_type: 'view_account', block_id: toH, account_id: w }).catch(() => null);
  out.wallets[w] = { fromYocto: a?.amount ?? null, toYocto: b?.amount ?? null };
  console.error(w, a?.amount, b?.amount);
  await sleep(500);
}
fs.writeFileSync('fixtures/buyback-wallets.json', JSON.stringify(out, null, 1));
