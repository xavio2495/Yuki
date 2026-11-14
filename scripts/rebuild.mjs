// Yuki: OFFLINE rebuild of every results/*.json and the chart page from fixtures. No network.
// Run (repo root): node --dns-result-order=ipv4first --max-old-space-size=2048 scripts/rebuild.mjs
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
const node = [process.execPath, '--dns-result-order=ipv4first', '--max-old-space-size=2048'];
const steps = ['scripts/rhea-analyze.mjs', 'scripts/intents-analyze.mjs', 'scripts/hub-analyze.mjs'];
if (fs.existsSync('fixtures/hub-quotes.json.gz')) steps.push('scripts/hub-quotes-analyze.mjs');
if (fs.existsSync('fixtures/defillama-accrual.json')) steps.push('scripts/model-analyze.mjs');
if (fs.existsSync('fixtures/chunk-authors.json')) steps.push('scripts/chunk-analyze.mjs');
if (fs.existsSync('fixtures/chunk-authors-fullweek.json')) steps.push(['scripts/chunk-analyze.mjs', 'fixtures/chunk-authors-fullweek.json', 'results/chunk-producers-fullweek.json']);
steps.push('scripts/build-web.mjs', 'scripts/manifest.mjs');
for (const step of steps) { const args = [].concat(step); const t = Date.now(); execFileSync(node[0], [...node.slice(1), ...args], { stdio: ['ignore', 'ignore', 'inherit'] }); console.log('ok', args.join(' '), ((Date.now() - t) / 1000).toFixed(1) + 's'); }
