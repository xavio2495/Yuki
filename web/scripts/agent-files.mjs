// Writes the agent-readable copy of the site into public/: llms.txt, llms-full.txt and a Markdown (or text)
// counterpart for every page, from the same data the site renders. Run by sync-data.mjs.
import fs from 'node:fs';
import path from 'node:path';

const SITE = 'https://yuki.xavio.dev';
const usd = v => '$' + Math.round(v).toLocaleString('en-US');
const f1 = v => (Math.round(v * 10) / 10).toString();

export function writeAgentFiles({ root, out, numbers: n, papers, outputs, series, readPaper }) {
  const pub = path.join(out);
  const w = (rel, text) => { const p = path.join(pub, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text.trimEnd() + '\n'); };
  const t = n.treasury, md = n.model;
  const authors = 'Immanuel and Charles, independent researchers';

  const thesis = md ? [
    `1. Holders gain through one stream: NEAR is bought back into holder-aligned wallets at about ${f1(md.walletPct ?? md.offsetBuyback)} % of issuance, measured on chain (DefiLlama attributes ${f1(md.offsetBuyback)} %; purchases visible on chain are at least 2.7 %).`,
    `2. Selling transaction order would add little: all on-chain arbitrage is about ${md.offsetArb.toFixed(1)} % of issuance, and validators get no share of fees.`,
    `3. Users pay for distribution: ${f1(n.intents.totalBps)} bps on public Intents swaps (${f1(n.intents.appFeeBps)} bps app fees)${t ? ` and about ${f1(t.allBps)} bps all-in on the confidential route` : ''}; holders keep ${Math.round(md.holderShareOfUserCost.tokenDiff)}–${Math.round(md.holderShareOfUserCost.treasuryValueWeighted)} % of it.`,
    `4. Intents volume is the lever: about ${f1(md.breakevenMultiple)}x today's Intents volume would let buybacks match issuance at today's fee rate (${f1(md.feeBps)} bps) and holders' share (${f1(md.holdersSharePct)} % of fees).`,
    `5. The buyback is a policy, not a protocol rule, and most fee splits happen off the public chain.`,
  ].join('\n') : '';

  const pages = [
    ['index.md', 'Landing page: the question, the thesis in five lines, key numbers and what to watch'],
    ['litepaper.md', `Litepaper (journal form, ${papers.lite?.words ?? 0} words): ${papers.lite?.title ?? ''}`],
    ['whitepaper.md', `Whitepaper (full record and investment thesis, ${papers.white?.words ?? 0} words): ${papers.white?.title ?? ''}`],
    ['summary.md', 'Summary: every finding and chart as text and tables, plus the value-accrual model'],
    ['code.md', 'Code: index of the analysis code, results, Lean proofs, offline verify log and pre-registration'],
  ];

  // ---------------------------------------------------------------- index.md
  const index = `# Yuki

> On a chain that does not sell transaction order, where does trading value go, and who pays for it? A long-term investment thesis for NEAR, judged on reproducible evidence. By ${authors}.

Data: NEAR mainnet blocks ${n.range.from.toLocaleString('en-US')} to ${n.range.to.toLocaleString('en-US')} (${n.range.dates}), ${n.range.windows} sampled windows of 600 blocks, plus 30-day public series for value accrual.

## The thesis in five lines

${thesis}

## Key numbers

| Measure | Value |
|---|---|
| On-chain arbitrage on Rhea, baseline | ${usd(n.rhea.baselinePerDay)}/day (95 % CI ${usd(n.rhea.baselineCI[0])}–${usd(n.rhea.baselineCI[1])}) |
| Share of transaction fees to validators | 0 % |
| User cost, public Intents swaps | ${f1(n.intents.totalBps)} bps (app fees ${f1(n.intents.appFeeBps)}, solver spread ${f1(n.intents.solverBps)}, protocol ${n.intents.protocolBps.toFixed(2)}) |
${t ? `| User cost, confidential route (all-in, value-weighted) | ${f1(t.allBps)} bps (95 % CI ${f1(t.allCI[0])}–${f1(t.allCI[1])}), ${t.quotes} priced quotes |\n` : ''}${md ? `| NEAR bought back into revenue wallets, on chain | ${f1(md.walletPct)} % of issuance (${(md.walletNearPerDay ?? 0).toLocaleString('en-US')} NEAR/day) |
| Intents volume needed for buybacks to match issuance | ${f1(md.breakevenMultiple)}x today |
` : ''}| Offline checks passing | ${n.verify.passed}/${(n.verify.passed ?? 0) + n.verify.failed} |

${md ? `## What to watch (30-day averages)

- Intents volume: ${usd(md.volumePerDay / 1e6)}M/day
- Fee rate: ${f1(md.feeBps)} bps
- Holders' share of fees: ${f1(md.holdersSharePct)} %
` : ''}
## Pages

${pages.slice(1).map(([p, d]) => `- [${d}](${SITE}/${p})`).join('\n')}
- Interactive site: ${SITE}/ (the same content; papers at ${SITE}/#litepaper and ${SITE}/#whitepaper, slides at ${SITE}/#summary)
`;
  w('index.md', index);

  // ---------------------------------------------------------------- papers
  const lite = readPaper('PAPER.md'), white = readPaper('WHITEPAPER.md');
  if (lite) w('litepaper.md', lite);
  if (white) w('whitepaper.md', white);

  // ---------------------------------------------------------------- summary.md
  const table = (head, rows) => `| ${head.join(' | ')} |\n|${head.map(() => '---').join('|')}|\n${rows.map(r => `| ${r.join(' | ')} |`).join('\n')}`;
  const summary = `# Yuki: summary of findings

By ${authors}. Every number below is recomputed offline from stored public data unless marked [secondary].

## The thesis in five lines

${thesis}

## The long-term case
${md ? `The investable quantity is Intents volume × fee rate × holders' share. Over the last 30 days NEAR built up in the buyback and revenue wallets at ${f1(md.walletPct)} % of issuance, measured on chain; DefiLlama attributes ${f1(md.offsetBuyback)} % of issuance to the Intents-fee buyback [secondary]; burnt gas offsets ${f1(md.offsetBurn)} % and all on-chain arbitrage ${md.offsetArb.toFixed(2)} % (${md.offsetArbMean.toFixed(2)} % including one spike). Holders receive ${f1(md.holdersBps)} bps of Intents volume. About ${f1(md.breakevenMultiple)}x today's volume would let buybacks match issuance. Since the buyback began on 2026-02-23 it has averaged ${f1(md.sinceBuybackOffset)} % of issuance. The bought-back NEAR is held, not burned. The buyback is a policy, not a protocol rule.` : ''}

## Value-accrual model (re-run it)

issuance per day = supply × inflation / 365 × price; buyback = volume × fee rate × holders' share; offset = (buyback + burn) / issuance; break-even volume = (issuance − burn) / (fee rate × share).
${md ? `Inputs (30 days): Intents volume ${usd(md.volumePerDay)}/day, fee rate ${f1(md.feeBps)} bps, holders' share ${f1(md.holdersSharePct)} %, gas burn ${usd(md.gasBurnPerDay)}/day, supply ${md.supplyNear.toLocaleString('en-US')} NEAR, inflation ${md.inflationPct} %, NEAR price $${md.nearUsd} (study week median). Output: issuance ${usd(md.issuancePerDay)}/day; offset ${f1(md.offsetBuyback + md.offsetBurn)} %; break-even ${f1(md.breakevenMultiple)}x volume. Live version: ${SITE}/#summary/model and ${SITE}/#summary/live.` : ''}

## Arbitrage (Rhea, on-chain AMM)
Cyclic arbitrage earns about ${usd(n.rhea.baselinePerDay)}/day outside one six-minute router-driven event that held ${f1(n.rhea.spikeSharePct)} % of the week's profit; the registered estimator including it is ${usd(n.rhea.meanPerDay)}/day. Top three senders take ${f1(n.rhea.top3Pct)} %; back-runs earn ${f1(n.rhea.backrunPct)} %; 0 confirmed sandwiches of ${n.rhea.sandwichPatterns} same-pool patterns.

Arbitrage profit per sampled window (USD, sample values, ${series.arbPerWindow.length} windows): ${series.arbPerWindow.join(', ')}

## Validators
Gas is burnt and validators are paid from issuance. Full-week test of ${n.validators.winnersTested} winning back-runs: producers vs schedule p = ${n.validators.chunkT1p}; winners vs failed attempts within shard and window p = ${n.validators.chunkT2bp}. No detectable producer preference.

## Public Intents swaps (token_diff)
Users pay ${f1(n.intents.totalBps)} bps against mid: app fees ${f1(n.intents.appFeeBps)}, solver spread ${f1(n.intents.solverBps)} (CI includes 0), protocol ${n.intents.protocolBps.toFixed(2)}. Under $100 the cost is ${Math.round(n.intents.under100Bps)} bps. This slice is about ${f1(n.intents.coveragePct)} % of DefiLlama-reported Intents volume.

${table(['Trade size', 'App fee bps', 'Solver bps', 'Protocol bps'], series.stack.map(r => [r.label, r.app, r.solver, r.protocol]))}

${t ? `## Confidential (Treasury) route
The account in ${f1(n.intents.hubTxPct)} % of Intents transactions is the Treasury of the Private PoA Bridge; trades settle on intents.far, out of public view. All-in user cost from the public shield and release legs:

${table(['Slice', 'bps (value-weighted)', '95 % CI', 'Priced quotes'], series.treasury.map(r => [r.label, r.bps, r.ci ? `${r.ci[0]}–${r.ci[1]}` : '', r.quotes]))}
` : ''}
## Verification
${n.verify.passed} offline checks pass; algebra machine-checked in Lean 4; pre-registration SHA-256 ${n.prereg.sha256}, hashed ${n.prereg.hashedAt}, stamped with OpenTimestamps at ${n.prereg.stampedAt} and anchored in Bitcoin block 975,830.
`;
  w('summary.md', summary);

  // ---------------------------------------------------------------- code
  const groups = { code: 'Analysis code', results: 'Results (JSON)', proofs: 'Lean proofs', verify: 'Offline verify log', prereg: 'Pre-registration' };
  const fileUrl = f => `${SITE}/code/${f.path.replace(/[^A-Za-z0-9._/-]/g, '_')}.txt`;
  let codeMd = `# Yuki: code, results and proofs\n\nEvery file the analysis uses, as plain text. Source repository: https://github.com/xavio2495/Yuki\n`;
  for (const [g, label] of Object.entries(groups)) {
    const files = outputs[g] ?? [];
    if (!files.length) continue;
    codeMd += `\n## ${label}\n\n` + files.map(f => `- [${f.path}](${fileUrl(f)}) (${f.text.split('\n').length} lines)`).join('\n') + '\n';
    for (const f of files) w(`code/${f.path.replace(/[^A-Za-z0-9._/-]/g, '_')}.txt`, f.text);
  }
  w('code.md', codeMd);

  // raw results for agents that want the numbers directly
  for (const f of fs.readdirSync(path.join(root, 'results')).filter(x => x.endsWith('.json') && !x.includes('winning-backruns'))) {
    fs.mkdirSync(path.join(pub, 'data'), { recursive: true });
    fs.copyFileSync(path.join(root, 'results', f), path.join(pub, 'data', f));
  }

  // ---------------------------------------------------------------- llms.txt + llms-full.txt
  const dataFiles = fs.readdirSync(path.join(pub, 'data')).sort();
  const llms = `# Yuki

> A long-term investment thesis for NEAR, judged on reproducible evidence: on a chain that does not sell transaction order, where does trading value go, and who pays for it? By ${authors}. Every page below has a Markdown version; numbers are recomputed offline from stored public NEAR mainnet data.

${thesis}

## Pages

${pages.map(([p, d]) => `- [${d}](${SITE}/${p})`).join('\n')}

## Data

${dataFiles.map(f => `- [${f}](${SITE}/data/${f}): committed analysis output`).join('\n')}

## Optional

- [Everything in one file](${SITE}/llms-full.txt)
- [Source repository](https://github.com/xavio2495/Yuki): run \`node scripts/verify.mjs\` offline to recompute every number
`;
  w('llms.txt', llms);
  w('llms-full.txt', [llms, index, summary, lite ?? '', white ?? '', codeMd].join('\n\n---\n\n'));

  // robots: agents welcome
  w('robots.txt', `User-agent: *\nAllow: /\n\n# Agent-readable index of this site\n# ${SITE}/llms.txt\n`);
  return { files: ['llms.txt', 'llms-full.txt', 'index.md', 'litepaper.md', 'whitepaper.md', 'summary.md', 'code.md', 'robots.txt'], code: Object.values(outputs).flat().length, data: dataFiles.length };
}
