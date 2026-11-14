// Builds app/_data/site.json for the website from the research outputs in the repo root:
// headline numbers from results/*.json and the two papers rendered to HTML (KaTeX for math).
// Run from web/: node scripts/sync-data.mjs   (runs automatically before dev and build)
import fs from 'node:fs';
import path from 'node:path';
import katex from 'katex';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const json = p => JSON.parse(read(p));
const exists = p => fs.existsSync(path.join(ROOT, p));

// ---------- minimal Markdown → HTML (only what the two papers use)
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const slug = s => s.toLowerCase().replace(/<[^>]+>/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
const tex = (t, display) => { try { return katex.renderToString(t, { displayMode: display, throwOnError: false, output: 'html' }); } catch { return esc(t); } };

function inline(s) {
  const keep = [];
  const stash = h => `\u0000${keep.push(h) - 1}\u0000`;
  s = s.replace(/\{\{red:\s*([^}]*)\}\}/g, (_, t) => stash(`<span class="todo">${esc(t)}</span>`));
  s = s.replace(/`([^`]+)`/g, (_, c) => stash(`<code>${esc(c)}</code>`));
  // inline math only when it opens on a letter, backslash or '(' (so '$347/day ... $171' stays currency)
  s = s.replace(/\$(?=[A-Za-z\\(])([^$\n|]{0,80}?[^\s$])\$/g, (_, m) => stash(tex(m, false)));
  s = s.replace(/\[@([\w; @]+)\]/g, (_, k) => stash(`<span class="cite">[${esc(k.replace(/@/g, '').replace(/;\s*/g, ', '))}]</span>`));
  s = esc(s);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => /^https?:/.test(u) ? `<a href="${u}" target="_blank" rel="noreferrer">${t}</a>` : t);
  s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noreferrer">$2</a>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\w)/g, '$1<em>$2</em>');
  s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => keep[+i]);
}

function markdown(md) {
  const lines = md.replace(/\r/g, '').split('\n');
  const out = [], toc = [];
  let i = 0;
  const isTable = l => /^\s*\|.*\|\s*$/.test(l);
  const listRe = /^(\s*)([-*]|\d+[.)])\s+(.*)$/;
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    if (/^```/.test(l)) { const buf = []; i++; while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]); i++; out.push(`<pre><code>${esc(buf.join('\n'))}</code></pre>`); continue; }
    if (/^\$\$/.test(l.trim())) {
      let buf = l.trim(); while (!/\$\$(\s*<<E:\w+>>)?\s*$/.test(buf.slice(2)) && i + 1 < lines.length) buf += '\n' + lines[++i]; i++;
      const body = buf.replace(/<<E:\w+>>/, '').trim().replace(/^\$\$|\$\$$/g, '');
      const tag = body.match(/\\tag\{([^}]+)\}/); out.push(`<div class="eq">${tex(body.replace(/\\tag\{[^}]+\}/, ''), true)}${tag ? `<span class="eqn">(${tag[1]})</span>` : ''}</div>`); continue;
    }
    const h = l.match(/^(#{1,4})\s+(.*)$/);
    if (h) { const lv = h[1].length, html = inline(h[2]), id = slug(h[2]); if (lv >= 2 && lv <= 3) toc.push({ id, level: lv, text: h[2].replace(/[`*]/g, '') }); out.push(`<h${lv} id="${id}">${html}</h${lv}>`); i++; continue; }
    if (/^-{3,}\s*$/.test(l)) { out.push('<hr/>'); i++; continue; }
    if (isTable(l) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      const row = r => r.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      const head = row(l); i += 2; const body = [];
      while (i < lines.length && isTable(lines[i])) body.push(row(lines[i++]));
      out.push(`<div class="tbl"><table><thead><tr>${head.map(c => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${body.map(r => `<tr>${r.map(c => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    if (listRe.test(l)) {
      // nested lists by indentation
      const items = [];
      while (i < lines.length && (listRe.test(lines[i]) || (/^\s{2,}\S/.test(lines[i]) && items.length))) {
        const m = lines[i].match(listRe);
        if (m) items.push({ ind: m[1].length, ord: /\d/.test(m[2]), text: m[3] });
        else items[items.length - 1].text += ' ' + lines[i].trim();
        i++;
      }
      let html = '', stack = [];
      for (const it of items) {
        while (stack.length && it.ind < stack[stack.length - 1].ind) { html += `</li></${stack.pop().tag}>`; }
        if (!stack.length || it.ind > stack[stack.length - 1].ind) { const tag = it.ord ? 'ol' : 'ul'; stack.push({ ind: it.ind, tag }); html += `<${tag}>`; }
        else html += '</li>';
        html += `<li>${inline(it.text)}`;
      }
      while (stack.length) html += `</li></${stack.pop().tag}>`;
      out.push(html); continue;
    }
    if (/^>\s?/.test(l)) { const buf = []; while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, '')); out.push(`<blockquote>${inline(buf.join(' '))}</blockquote>`); continue; }
    const buf = [l]; i++;
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|```|\$\$|-{3,}\s*$|>\s?)/.test(lines[i]) && !listRe.test(lines[i]) && !isTable(lines[i])) buf.push(lines[i++]);
    out.push(`<p>${inline(buf.join(' '))}</p>`);
  }
  return { html: out.join('\n'), toc };
}

function paper(file) {
  if (!exists(file)) return null;
  const md = read(file);
  const title = (md.match(/^#\s+(.*)$/m) || [, file])[1];
  const { html, toc } = markdown(md.replace(/^#\s+.*$/m, ''));
  return { title, html, toc, words: md.split(/\s+/).length };
}

// ---------- numbers
const R = json('results/rhea.json'), I = json('results/intents.json'), C = json('results/coverage.json');
const H = exists('results/hub-quotes.json') ? json('results/hub-quotes.json') : null;
const CHF = exists('results/chunk-producers-fullweek.json') ? json('results/chunk-producers-fullweek.json') : null;
const CH = CHF || json('results/chunk-producers.json');
const verifyLine = (read('README.md').match(/(\d+) passed, (\d+) failed/) || []);
const st = I.extended.stack;
const numbers = {
  rhea: { baselinePerDay: R.extended.robust.exSpikePerDayUsd, baselineCI: R.extended.robust.exSpikeCI95PerDayUsd, baselineBps: R.extended.robust.exSpikeBpsOfVolume, meanPerDay: R.original.cyclicArb.grossPerDayUsd, spikeSharePct: R.extended.robust.spikeSharePct, top3Pct: R.extended.concentration.bySender.top3Pct, top3ExSpikePct: R.extended.concentration.exSpikeBySender.top3Pct, backrunPct: R.original.backruns.sharePct, sandwichPatterns: R.original.sandwiches.candidates, issuancePct: R.original.issuance.arbPctOfIssuance, volumePerDay: R.original.cyclicArb.grossPerDayUsd / R.original.cyclicArb.bpsOfVolume * 1e4 },
  intents: { appFeeBps: st.appFeeBps ?? 24.07, totalBps: 32.16, solverBps: 8.07, protocolBps: 0.027, under100Bps: I.extended.bySize.find(b => b.bucket === '<$100')?.totalBps, coveragePct: C.reconciliation.tokenDiffShareOfDefillamaPct, hubTxPct: C.hub.shareOfRangeTxsPct, llamaPerDay: C.reconciliation.defillamaDailyMeanUsd_2026_11_07_to_13 ?? null },
  treasury: H && { allBps: H.all.totalBps, allCI: H.all.ci95, otherBps: H.other.totalBps, otherCI: H.other.ci95, sameBps: H.sameAssetCrossChain.totalBps, sameCI: H.sameAssetCrossChain.ci95, quotes: H.all.quotes, medianQuoteBps: H.all.perQuoteBps.median, costPerDay: H.perDay.userCostUsd, robustBps: H.robustness?.all.totalBps },
  validators: { feeSharePct: 0, chunkT1p: CH.T1_vsSchedule.monteCarloP, chunkT2bp: CH.T2b_vsFailedSameSigners_withinWindow.permutationP, winnersTested: CH.coverage.winningBackrunsTested, fullWeek: !!CHF },
  verify: { passed: +verifyLine[1] || null, failed: +verifyLine[2] || 0 },
  model: exists('results/model.json') ? (() => { const M = json('results/model.json'), w = M.windows.last30d; return { fetchedAt: M.fetchedAt, issuancePerDay: M.issuance.perDayUsd, supplyNear: M.issuance.supplyNear, inflationPct: M.issuance.maxInflation * 100, nearUsd: M.issuance.nearUsd, volumePerDay: w.intentsVolumePerDay, feeBps: w.intentsFeeBps, holdersSharePct: w.holdersShareOfFeesPct, holdersBps: w.holdersBpsOfVolume, buybackPerDay: w.holdersRevenuePerDay, gasBurnPerDay: w.gasBurnPerDay, offsetBuyback: w.offsetPctOfIssuance.intentsBuyback, offsetBurn: w.offsetPctOfIssuance.gasBurn, offsetArb: w.offsetPctOfIssuance.arbitrageBaseline, offsetArbMean: w.offsetPctOfIssuance.arbitrageRegisteredMean, buybackVsBurn: w.buybackVsBurn, buybackVsArb: w.buybackVsArbBaseline, breakevenMultiple: w.breakevenGrowthMultiple, breakevenVolume: w.breakevenIntentsVolumePerDay, sinceBuybackOffset: M.windows.sinceBuyback.offsetPctOfIssuance.intentsBuyback, holderShareOfUserCost: M.holderShareOfUserCostPct, walletPct: M.walletAccumulation?.totalPctOfIssuance ?? null, walletNearPerDay: M.walletAccumulation?.totalNearPerDay ?? null }; })() : null,
  prereg: { sha256: '751ca84ec592f49058ae6c2499e0a8b18200276bcfc7ddd3014f69c719ae3fe8', hashedAt: '2026-11-14 16:17:43 UTC', stampedAt: '2026-11-14 18:06:28 UTC' },
  range: { from: 223455000, to: 224500000, dates: '2026-11-07 → 2026-11-14', windows: 168 },
};

// ---------- outputs: code, results, proofs, the offline verify log, the pre-registration
const MAXLINES = 1200;
const clip = (text, note) => { const lines = text.split('\n'); return lines.length > MAXLINES ? lines.slice(0, MAXLINES).join('\n') + `\n\n… truncated at ${MAXLINES} of ${lines.length} lines (${note}). The full file is in the repository.` : text; };
const listDir = (dir, re) => fs.readdirSync(path.join(ROOT, dir)).filter(f => re.test(f)).sort().map(f => path.join(dir, f));
const code = [...listDir('lib', /\.mjs$/), ...listDir('scripts', /\.mjs$/), 'lean/Yuki/Claims.lean'].filter(exists).map(f => ({ path: f, lang: f.endsWith('.lean') ? 'lean' : 'js', text: read(f) }));
const results = listDir('results', /\.json$/).map(f => {
  const raw = read(f);
  if (f.endsWith('rhea-winning-backruns.json')) return { path: f, lang: 'json', text: `// ${(raw.length / 1e6).toFixed(1)} MB intermediate (winning back-runs and failed attempts for the chunk-producer test); first entries only\n` + clip(JSON.stringify(JSON.parse(raw), null, 1), 'intermediate file') };
  return { path: f, lang: 'json', text: clip(raw, 'per-quote rows') };
});
let verifyLog = null;
try { verifyLog = execFileSync(process.execPath, ['--dns-result-order=ipv4first', '--max-old-space-size=2048', 'scripts/verify.mjs'], { cwd: ROOT, encoding: 'utf8', timeout: 120000 }); }
catch (e) { verifyLog = (e.stdout || '') + '\n' + (e.stderr || ''); }
const outputs = {
  code,
  results,
  proofs: exists('lean/Yuki/Claims.lean') ? [{ path: 'lean/Yuki/Claims.lean', lang: 'lean', text: read('lean/Yuki/Claims.lean') }] : [],
  verify: verifyLog ? [{ path: 'node scripts/verify.mjs', lang: 'text', text: verifyLog }] : [],
  prereg: exists('PREREGISTRATION.md') ? [{ path: 'PREREGISTRATION.md', lang: 'text', text: read('PREREGISTRATION.md') }] : [],
};
const series = {
  arbPerWindow: R.extended.perWindow.map(w => +w.arbUsd.toFixed(2)),
  solverPerWindow: I.extended.perWindow.map(w => +w.solverUsd.toFixed(2)),
  spike: { index: R.extended.robust.spikeWindowIndex, sharePct: R.extended.robust.spikeSharePct },
  solverTop: { index: I.extended.perWindow.reduce((m, p) => (p.solverUsd > m.solverUsd ? p : m)).i, sharePct: I.extended.fragility.topSwap.sharePctOfSolverCapture },
  stack: [{ label: 'All priced swaps', app: I.extended.stack.appFeeBps ?? 24.07, solver: I.extended.stack.solverBps ?? 8.07, protocol: I.extended.stack.protocolBps ?? 0.027 },
    ...I.extended.bySize.map(b => ({ label: b.bucket, app: b.appFeeBps, solver: b.solverBps, protocol: b.protocolBps }))],
  treasury: H ? [['All priced', H.all], ['Same asset, cross-chain', H.sameAssetCrossChain], ['Stable to stable', H.stableToStable], ['Other pairs', H.other], ...Object.entries(H.bySize).map(([k, v]) => [k, v])].map(([label, b]) => ({ label, bps: b.totalBps, ci: b.ci95, quotes: b.quotes })) : [],
};

const DATA = path.join(import.meta.dirname, '..', 'app', '_data', 'site.json');
const prev = fs.existsSync(DATA) ? JSON.parse(fs.readFileSync(DATA, 'utf8')) : null;
// a checkout without the papers keeps the last rendered copies instead of dropping them
const out = { generatedAt: new Date().toISOString(), numbers, papers: { lite: paper('PAPER.md') ?? prev?.papers?.lite ?? null, white: paper('WHITEPAPER.md') ?? paper('THESIS.md') ?? prev?.papers?.white ?? null }, outputs: { ...outputs, prereg: outputs.prereg.length ? outputs.prereg : prev?.outputs?.prereg ?? [] }, series };
fs.mkdirSync(path.join(import.meta.dirname, '..', 'app', '_data'), { recursive: true });
fs.writeFileSync(DATA, JSON.stringify(out));
console.log('site.json:', Object.keys(out.papers).map(k => `${k} ${out.papers[k]?.words ?? 0} words`).join(', '), '| verify', numbers.verify.passed, '| code', code.length, 'results', results.length, '| bytes', JSON.stringify(out).length);
