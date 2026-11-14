// Shared I/O helpers: read .jsonl or .jsonl.gz, SHA-256 of the *uncompressed* bytes, small stats helpers.
import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
export function readText(p) {
  if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
  if (fs.existsSync(p + '.gz')) return zlib.gunzipSync(fs.readFileSync(p + '.gz')).toString('utf8');
  throw new Error('missing input ' + p + '(.gz)');
}
export const readJson = p => JSON.parse(readText(p));
export const readLines = p => readText(p).trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
export const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');
export const sum = (a, f = x => x) => a.reduce((s, x) => s + f(x), 0);
export const med = xs => { const s = xs.slice().sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
// Same LCG + percentile convention as the original analysers (seeded, 2000 resamples over windows).
// hiOffset: the pack Rhea script used index floor(0.975B)=1950, its Intents script used 1949; both kept for exact reproduction.
export function bootstrap(arr, seed, B = 2000, hiOffset = 0) {
  let st = seed; const rnd = () => (st = (st * 1103515245 + 12345) % 2147483648) / 2147483648;
  const out = [];
  for (let b = 0; b < B; b++) { let s = 0; for (let i = 0; i < arr.length; i++) s += arr[Math.floor(rnd() * arr.length)]; out.push(s); }
  out.sort((a, b) => a - b);
  return [out[Math.floor(0.025 * B)], out[Math.floor(0.975 * B) - hiOffset]];
}
export const round = (v, d = 2) => v == null ? null : +(+v).toFixed(d);
