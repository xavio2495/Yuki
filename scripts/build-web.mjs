// Yuki: OFFLINE. Builds web/index.html (static, no external dependencies, inline SVG) from results/*.json.
// Run: node scripts/build-web.mjs
import fs from 'node:fs';
import { readJson } from '../lib/io.mjs';
const R = readJson('results/rhea.json'), I = readJson('results/intents.json'), C = readJson('results/coverage.json');
const CH = fs.existsSync('results/chunk-producers.json') ? readJson('results/chunk-producers.json') : null;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const usd = v => (v < 0 ? '−$' : '$') + Math.abs(Math.round(v)).toLocaleString('en-US');
const days = R.original.days;

// ---- chart 1: Rhea arbitrage profit per sampled window (sample $, unscaled)
function windowBars(vals, { w = 860, h = 240, label, color = 'var(--series-1)', fmt = v => '$' + v.toFixed(2), annotate }) {
  const padL = 56, padB = 28, padT = 16, iw = w - padL - 12, ih = h - padB - padT;
  const max = Math.max(...vals.map(v => v.y)), min = Math.min(0, ...vals.map(v => v.y));
  const y = v => padT + ih * (max - v) / (max - min || 1);
  const bw = iw / vals.length;
  const ticks = [min, 0, max / 2, max].filter((v, i, a) => a.indexOf(v) === i);
  let s = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}" class="chart">`;
  for (const t of ticks) s += `<line x1="${padL}" x2="${w - 12}" y1="${y(t)}" y2="${y(t)}" class="grid"/><text x="${padL - 6}" y="${y(t) + 4}" class="tick" text-anchor="end">${esc(fmt(t))}</text>`;
  vals.forEach((v, i) => {
    const x = padL + i * bw, y0 = y(0), y1 = y(v.y), top = Math.min(y0, y1), hh = Math.max(Math.abs(y1 - y0), v.y ? 1 : 0);
    s += `<g class="hit"><rect x="${x}" y="${padT}" width="${bw}" height="${ih}" fill="transparent"/><rect x="${x + 0.5}" y="${top}" width="${Math.max(bw - 1, 1)}" height="${hh}" rx="1" fill="${v.y < 0 ? 'var(--series-2)' : color}"/><title>${esc(v.title)}</title></g>`;
  });
  s += `<line x1="${padL}" x2="${w - 12}" y1="${y(0)}" y2="${y(0)}" class="axis"/>`;
  s += `<text x="${padL}" y="${h - 8}" class="tick">window 1 (2026-11-07)</text><text x="${w - 12}" y="${h - 8}" class="tick" text-anchor="end">window 168 (2026-11-14)</text>`;
  if (annotate) { const i = annotate.i, x = padL + i * bw + bw / 2; s += `<text x="${x - 6}" y="${y(vals[i].y) + 12}" class="anno" text-anchor="end">${esc(annotate.text)}</text>`; }
  return s + '</svg>';
}
const rw = R.extended.perWindow.map(p => ({ y: p.arbUsd, title: `window ${p.i + 1} (from block ${p.from}): arbitrage profit $${p.arbUsd.toFixed(2)} in the sample, priced volume $${p.volUsd.toLocaleString('en-US')}` }));
const spike = R.extended.robust;
const chart1 = windowBars(rw, { label: 'Rhea cyclic arbitrage profit per sampled 600-block window', annotate: { i: spike.spikeWindowIndex, text: `block ${spike.spikeWindowFrom}: ${spike.spikeSharePct}% of the week` } });
const iw = I.extended.perWindow.map(p => ({ y: p.solverUsd, title: `window ${p.i + 1} (from block ${p.from}): solver capture $${p.solverUsd.toFixed(2)}, app fees $${p.appFeeUsd.toFixed(2)} (sample)` }));
const topI = I.extended.perWindow.reduce((m, p) => p.solverUsd > m.solverUsd ? p : m);
const chart3 = windowBars(iw, { label: 'Intents solver capture per sampled window (token_diff swaps)', annotate: { i: topI.i, text: `one $242.8k USDT→USDC swap: ${I.extended.fragility.topSwap.sharePctOfSolverCapture}% of the week` } });

// ---- chart 2: stacked horizontal bars, what users pay (bps of priced user volume), by trade size + all
function stack(rows, { w = 860 }) {
  const segs = [['appFeeBps', 'Integrator / app fees', 'var(--series-1)'], ['solverBps', 'Solver spread at mid', 'var(--series-2)'], ['protocolBps', 'Protocol fee (fees_collected)', 'var(--series-3)']];
  const rowH = 30, padL = 150, padR = 90, padT = 34, h = padT + rows.length * (rowH + 10) + 10;
  const max = Math.max(...rows.map(r => segs.reduce((s, [k]) => s + Math.max(0, r[k]), 0)));
  const xs = v => (w - padL - padR) * v / max;
  let s = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="User cost stack in basis points" class="chart">`;
  segs.forEach(([, name, c], i) => { s += `<rect x="${padL + i * 230}" y="6" width="12" height="12" rx="2" fill="${c}"/><text x="${padL + i * 230 + 18}" y="16" class="tick">${esc(name)}</text>`; });
  rows.forEach((r, j) => {
    const y = padT + j * (rowH + 10); let x = padL;
    s += `<text x="${padL - 8}" y="${y + rowH / 2 + 4}" class="lab" text-anchor="end">${esc(r.label)}</text>`;
    for (const [k, name, c] of segs) { const v = Math.max(0, r[k]); const ww = xs(v); if (ww <= 0) continue; s += `<g class="hit"><rect x="${x}" y="${y}" width="${Math.max(ww - 2, 0.8)}" height="${rowH}" rx="3" fill="${c}"/><title>${esc(`${r.label}: ${name} ${r[k]} bps`)}</title></g>`; if (ww > 34) s += `<text x="${x + ww / 2}" y="${y + rowH / 2 + 4}" class="inbar" text-anchor="middle">${r[k].toFixed(1)}</text>`; x += ww; }
    s += `<text x="${x + 6}" y="${y + rowH / 2 + 4}" class="lab">${r.totalBps.toFixed(1)} bps</text>`;
  });
  return s + '</svg>';
}
const st = I.extended.stack;
const stackRows = [{ label: 'All priced swaps', ...st }, ...I.extended.bySize.map(b => ({ label: b.bucket, ...b }))];
const chart2 = stack(stackRows, {});
const tbl = (head, rows) => `<table><thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
const sizeTable = tbl(['Trade size', 'Swaps', 'Volume $/day', 'App fee bps', 'Solver bps', 'Protocol bps', 'Total bps'], stackRows.map(r => [r.label, r.swaps, usd(r.volumePerDayUsd), r.appFeeBps, r.solverBps, r.protocolBps, r.totalBps]));
const intTable = tbl(['Integrator (referral)', 'Swaps', 'Volume $/day', 'App fee bps', 'Solver bps', 'Total bps'], I.extended.byIntegrator.filter(r => r.swaps >= 10 || r.volumePerDayUsd > 100000).map(r => [r.integrator, r.swaps, usd(r.volumePerDayUsd), r.appFeeBps, r.solverBps, r.totalBps]));
const sensTable = tbl(['Solver rule', 'Solver $/day', '95% CI', 'Solver bps', 'App fee bps', 'Total bps'], I.sensitivity.map(s => [s.rule, usd(s.solverCapturePerDayUsd), `${usd(s.solverCI95[0])} to ${usd(s.solverCI95[1])}`, s.solverBps, s.appFeeBps, s.totalUserBps]));
const rheaTable = tbl(['Measure', 'Value'], [
  ['Arbitrage, gross $/day (pre-registered estimator)', `${usd(R.original.cyclicArb.grossPerDayUsd)} (95% CI ${usd(R.original.cyclicArb.ci95PerDayUsd[0])} to ${usd(R.original.cyclicArb.ci95PerDayUsd[1])})`],
  ['Baseline without the spike window', `${usd(spike.exSpikePerDayUsd)} (95% CI ${usd(spike.exSpikeCI95PerDayUsd[0])} to ${usd(spike.exSpikeCI95PerDayUsd[1])})`],
  ['Spike window share / median window', `${spike.spikeSharePct}% / $${spike.medianWindowUsd}`],
  ['Top-3 senders (all / ex-spike)', `${R.original.cyclicArb.top3SharePct}% / ${R.extended.concentration.exSpikeBySender.top3Pct}%`],
  ['Back-runs share of profit', `${R.original.backruns.sharePct}%`],
  ['Confirmed sandwiches (same-pool shape)', '0 (1 strict candidate, rejected on review)'],
]);
const covTable = tbl(['Measure', 'Value'], [
  ['DefiLlama NEAR Intents, mean daily volume 2026-11-07..13', usd(C.reconciliation.defillamaDailyMeanUsd_2026_11_07_to_13)],
  ['Priced token_diff user volume (this study)', `${usd(C.reconciliation.tokenDiffPricedUserVolumePerDayUsd)} (${C.reconciliation.tokenDiffShareOfDefillamaPct}%)`],
  ['intents.near txs with a token_diff event (random sample)', `${C.txKinds.token_diff?.pct ?? 0}% of ${C.sample.txs}`],
  ['Txs touching implicit account 51e8f94d… (full range)', `${C.hub.shareOfRangeTxsPct}%`],
  ['Value sent by 51e8f94d… (sample estimate)', `${usd(C.hub.sentPerDayUsd)}/day (95% CI ${usd(C.hub.sentPerDayCI95[0])} to ${usd(C.hub.sentPerDayCI95[1])})`],
]);
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Yuki: where trading value goes on NEAR</title>
<style>
.viz-root{color-scheme:light;--surface-1:#fcfcfb;--text-primary:#0b0b0b;--text-secondary:#52514e;--grid:#e4e3df;--series-1:#2a78d6;--series-2:#eb6834;--series-3:#1baf7a}
@media (prefers-color-scheme:dark){:root:where(:not([data-theme="light"])) .viz-root{color-scheme:dark;--surface-1:#1a1a19;--text-primary:#f0efec;--text-secondary:#c3c2b7;--grid:#34332f;--series-1:#3987e5;--series-2:#d95926;--series-3:#199e70}}
body{margin:0;background:#fcfcfb} @media (prefers-color-scheme:dark){body{background:#1a1a19}} .viz-root{background:var(--surface-1);color:var(--text-primary);font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;max-width:900px;margin:0 auto;padding:24px}
h1{font-size:24px;margin:0 0 4px} h2{font-size:18px;margin:32px 0 4px} p.sub,.note{color:var(--text-secondary)} .note{font-size:13px}
.chart{width:100%;height:auto;display:block} .grid{stroke:var(--grid);stroke-width:1} .axis{stroke:var(--text-secondary);stroke-width:1}
.tick{fill:var(--text-secondary);font-size:11px} .lab{fill:var(--text-primary);font-size:12px} .inbar{fill:#fff;font-size:11px;font-weight:600} .anno{fill:var(--text-primary);font-size:12px;font-weight:600}
.hit:hover rect:last-of-type{opacity:.75} table{border-collapse:collapse;font-size:13px;margin:8px 0;width:100%} th,td{border-bottom:1px solid var(--grid);padding:4px 6px;text-align:left} th{color:var(--text-secondary);font-weight:600}
.kpis{display:flex;gap:16px;flex-wrap:wrap;margin:16px 0} .kpi{flex:1 1 180px;border:1px solid var(--grid);border-radius:8px;padding:10px 12px} .kpi b{display:block;font-size:22px} .kpi span{color:var(--text-secondary);font-size:12px}
details{margin:6px 0}
</style></head><body><main class="viz-root">
<h1>Yuki: on a chain that does not sell transaction order, where does trading value go?</h1>
<p class="sub">NEAR mainnet, blocks 223,455,000–224,500,000 (2026-11-07 → 2026-11-14), 168 sampled windows of 600 blocks. Generated offline from <code>results/*.json</code> by <code>scripts/build-web.mjs</code>. Hover any bar for its value; every chart has a table below it.</p>
<div class="kpis">
<div class="kpi"><b>${usd(spike.exSpikePerDayUsd)}/day</b><span>Rhea on-chain arbitrage, baseline without one spike (results/rhea.json)</span></div>
<div class="kpi"><b>${st.totalBps} bps</b><span>what Intents users pay vs mid on priced token_diff swaps; ${st.appFeeBps} of it is integrator fees (results/intents.json)</span></div>
<div class="kpi"><b>${C.reconciliation.tokenDiffShareOfDefillamaPct}%</b><span>share of DefiLlama-reported Intents volume that token_diff swaps cover (results/coverage.json)</span></div>
</div>
<h2>1. Rhea: arbitrage profit per sampled window</h2>
<p class="note">Cyclic arbitrage (same token in and out within one transaction), USD, sample values (not scaled). One 6-minute window driven by a meme-router buying PEARL holds ${spike.spikeSharePct}% of the week; the median window earns $${spike.medianWindowUsd}.</p>
${chart1}${rheaTable}
<h2>2. NEAR Intents: what users pay, by trade size</h2>
<p class="note">Basis points of priced user volume, against Binance 1-minute mid. Integrator fees are <code>transfer</code> intents signed inside the user's own intent; solver spread is the solvers' token_diff gain at mid; the protocol fee is <code>fees_collected</code> (${st.protocolBps} bps, too thin to see). Token_diff swaps only (about ${C.reconciliation.tokenDiffShareOfDefillamaPct}% of reported Intents volume).</p>
${chart2}${sizeTable}
<details><summary>By integrator (referral tag), groups with ≥10 swaps or ≥$100k/day</summary>${intTable}<p class="note">Single-swap groups (allbridgecore, l2pass) are anecdotes, not rates. Negative solver bps mean users received more than mid.</p></details>
<h2>3. NEAR Intents: solver capture per sampled window</h2>
<p class="note">Signed; blue above zero = solvers gained at mid, orange below = solvers lost at mid. 95% CI of the daily figure: ${usd(I.original.perDay.solverCaptureCI95[0])} to ${usd(I.original.perDay.solverCaptureCI95[1])}, so it cannot be told apart from zero.</p>
${chart3}
<details><summary>Sensitivity to the solver rule</summary>${sensTable}</details>
<h2>4. Coverage: what this study does and does not see</h2>
${covTable}
${CH ? `<p class="note">Optional chunk-producer test (last ~23 windows only): winning back-runs vs the producer schedule p = ${CH.T1_vsSchedule.monteCarloP}; vs failed attempts by the same bots p = ${CH.T2_vsFailedSameSigners.permutationP} by shard, p = ${CH.T2b_vsFailedSameSigners_withinWindow.permutationP} within shard and window (${CH.coverage.winningBackrunsTested} winners): no producer-level clustering detected. See results/chunk-producers.json.</p>` : ''}
<p class="note">Labels in THESIS.md: [measured] = computed here from on-chain data; [secondary] = DefiLlama. Nothing on this page is a claim that users are leaving NEAR.</p>
</main></body></html>`;
fs.mkdirSync('web', { recursive: true });
fs.writeFileSync('web/index.html', html);
console.log('wrote web/index.html', html.length, 'bytes');
