// Yuki: write fixtures/MANIFEST.json = SHA-256 of every fixture file as stored (compressed bytes for .gz), plus the
// SHA-256 of the UNCOMPRESSED raw inputs (these equal the pack's published inputSha256 values) and of PREREGISTRATION.md.
// Run: node scripts/manifest.mjs
import fs from 'node:fs';
import path from 'node:path';
import { sha256, readText } from '../lib/io.mjs';
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const files = walk('fixtures').filter(f => !f.endsWith('MANIFEST.json')).sort();
const m = { writtenAt: new Date().toISOString(), files: {}, rawUncompressed: {}, preregistration: {} };
for (const f of files) m.files[f] = sha256(fs.readFileSync(f));
for (const f of ['fixtures/data/run-223455000-224500000/hops.jsonl', 'fixtures/data/intents-223455000-224500000/diffs.jsonl']) m.rawUncompressed[f] = sha256(readText(f));
m.preregistration['PREREGISTRATION.md'] = sha256(fs.readFileSync('PREREGISTRATION.md'));
fs.writeFileSync('fixtures/MANIFEST.json', JSON.stringify(m, null, 1));
console.log('manifest:', files.length, 'files');
