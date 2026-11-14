// Yuki: ONLINE. Daily series from DefiLlama's public API for the value-accrual model:
//   NEAR Intents volume, fees and holders' revenue (the buyback), and NEAR chain gas fees and burn.
// Read-only, 5 calls. Run: node --dns-result-order=ipv4first --max-old-space-size=2048 scripts/llama-fetch.mjs
// Writes fixtures/defillama-accrual.json (series as [unix seconds, usd] pairs, plus each series' methodology text).
import fs from 'node:fs';
const BASE = 'https://api.llama.fi';
const Q = {
  intentsVolume: '/summary/dexs/near-intents',
  intentsFees: '/summary/fees/near-intents?dataType=dailyFees',
  intentsHoldersRevenue: '/summary/fees/near-intents?dataType=dailyHoldersRevenue',
  chainGasFees: '/summary/fees/near?dataType=dailyFees',
  chainGasBurn: '/summary/fees/near?dataType=dailyRevenue',
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const out = { fetchedAt: new Date().toISOString(), source: BASE, series: {}, methodology: {} };
for (const [k, path] of Object.entries(Q)) {
  let j = null;
  for (let a = 0; a < 5 && !j; a++) { try { const r = await fetch(BASE + path); if (r.ok) j = await r.json(); } catch { } if (!j) await sleep(1500 * (a + 1)); }
  if (!j) throw new Error('fetch failed: ' + path);
  out.series[k] = j.totalDataChart;
  out.methodology[k] = j.methodology ?? null;
  console.error(k, j.totalDataChart.length, 'points, last', j.totalDataChart.at(-1));
  await sleep(400);
}
fs.writeFileSync('fixtures/defillama-accrual.json', JSON.stringify(out));
