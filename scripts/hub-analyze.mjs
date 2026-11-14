// Yuki: OFFLINE. Coverage reconciliation for NEAR Intents from a random tx sample (fixtures/hub-sample-events.json.gz):
//  - what share of intents.near txs carry token_diff (the slice the solver-capture result measures) vs transfer-only;
//  - the implicit account 51e8f94d... ("the hub"): share of txs, value it sends/receives, counterparties, memos;
//  - ledger boundary flows (deposits = mt_mint "deposit"; withdrawals = ft/mt/native_withdraw) by chain, as facts only;
//  - comparison with DefiLlama's reported NEAR Intents volume for the same days (fixtures/defillama-near-intents.json).
// Estimates scale the sample mean per tx to the API's full-range intents.near tx count. Post hoc; not pre-registered.
// Run: node --dns-result-order=ipv4first --max-old-space-size=2048 scripts/hub-analyze.mjs   -> results/coverage.json
import fs from 'node:fs';
import { readJson, readLines, sum, med } from '../lib/io.mjs';
import { makePricing, HUB } from '../lib/intents.mjs';
export function analyzeCoverage() {
  const S = readJson('fixtures/hub-sample-events.json');
  const facts = readJson('fixtures/hub-facts.json');
  const META = { ...readJson('fixtures/intents-meta.json').META, ...readJson('fixtures/intents-meta-extra.json').META };
  const { usd } = makePricing(META, readJson('fixtures/intents-klines.json'));
  const llama = readJson('fixtures/defillama-near-intents.json');
  const imeta = readJson('fixtures/data/intents-223455000-224500000/meta.json');
  const intentsRes = readJson('results/intents.json');
  // height -> ms timestamp, linear fit through the token_diff rows (all in the same range)
  const rows = readLines('fixtures/data/intents-223455000-224500000/diffs.jsonl');
  const a = rows.reduce((m, x) => x.h < m.h ? x : m), b = rows.reduce((m, x) => x.h > m.h ? x : m);
  const tsOf = h => a.ts + (h - a.h) * (b.ts - a.ts) / (b.h - a.h);
  const days = (imeta.end - imeta.start + 1) * 0.5787 / 86400;
  const fullTx = facts.txsCountRange['intents.near'];
  const txs = Object.entries(S.txs);
  const N = txs.length, perTxToDay = fullTx / N / days;
  const chainOf = t => { t = t.replace(/^nep141:/, ''); let m; if ((m = t.match(/^nep245:v2_1\.omni\.hot\.tg:(\d+)_/))) return 'hot-chain-' + m[1]; if (t === 'wrap.near') return 'near'; if ((m = t.match(/^([a-z0-9]+)(-0x[0-9a-f]+|-[A-Za-z0-9]+)?\.omft\.near$/))) return m[1]; if (/\.omdep\.near$/.test(t)) return 'omdep(bridged)'; if (/\.factory\.bridge\.near$/.test(t)) return 'eth(rainbow)'; if (t === 'nbtc.bridge.near') return 'btc'; return 'near-native'; };
  const per = []; const cp = {}; let memoCount = 0, hubTransfers = 0, unpricedHub = 0;
  const kind = {}; const flowsBy = { deposit: {}, withdraw: {} }; let unpricedFlow = 0, pricedFlow = 0;
  for (const [hash, t] of txs) {
    const ts = tsOf(t.h); const ev = t.ev.filter(e => e.ok);
    const has = n => ev.some(e => e.event === n);
    const hubInvolved = ev.some(e => (e.data || []).some(d => d.account_id === HUB || d.receiver_id === HUB || d.owner_id === HUB));
    const k = has('token_diff') ? 'token_diff' : has('transfer') ? 'transfer (no token_diff)' : has('mt_mint') ? 'deposit (mt_mint)' : (has('ft_withdraw') || has('mt_withdraw') || has('native_withdraw')) ? 'withdraw' : ev.length ? 'other events' : 'no intents.near event';
    kind[k] = (kind[k] || 0) + 1;
    let hubOut = 0, hubIn = 0, allTransfer = 0; const fl = { deposit: 0, withdraw: 0 };
    for (const e of ev) {
      if (e.event === 'transfer') for (const d of e.data) {
        const v = usd(d.tokens, ts);
        if (v != null) allTransfer += v;
        if (d.account_id === HUB || d.receiver_id === HUB) {
          hubTransfers++; if (d.memo) memoCount++;
          if (v == null) { unpricedHub++; continue; }
          const other = d.account_id === HUB ? d.receiver_id : d.account_id;
          if (d.account_id === HUB) hubOut += v; else hubIn += v;
          const o = (cp[other] ||= { n: 0, inUsd: 0, outUsd: 0 }); o.n++; if (d.account_id === HUB) o.outUsd += v; else o.inUsd += v;
        }
      }
      const addFlow = (dir, token, amount) => { const v = usd({ [token]: amount }, ts); const c = chainOf(token); const o = (flowsBy[dir][c] ||= { n: 0, usd: 0, unpriced: 0 }); o.n++; if (v == null) { o.unpriced++; unpricedFlow++; } else { o.usd += v; fl[dir] += v; pricedFlow++; } };
      if (e.event === 'mt_mint') for (const d of e.data) if (/deposit/i.test(d.memo || '')) d.token_ids.forEach((tk, i) => addFlow('deposit', tk, d.amounts[i]));
      if (e.event === 'ft_withdraw') for (const d of e.data) addFlow('withdraw', 'nep141:' + d.token, d.amount);
      if (e.event === 'mt_withdraw') for (const d of e.data) d.token_ids.forEach((tk, i) => addFlow('withdraw', 'nep245:' + d.token + ':' + tk, d.amounts[i]));
      if (e.event === 'native_withdraw') for (const d of e.data) addFlow('withdraw', 'nep141:wrap.near', d.amount);
    }
    per.push({ hash, hubInvolved, hubOut, hubIn, allTransfer, k, dep: fl.deposit, wd: fl.withdraw });
  }
  let seed = 5; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const bootMean = f => { const v = per.map(f), out = []; for (let i = 0; i < 2000; i++) { let s = 0; for (let j = 0; j < N; j++) s += v[Math.floor(rnd() * N)]; out.push(s / N); } out.sort((x, y) => x - y); return [out[50], out[1949]]; };
  const pd = v => Math.round(v * perTxToDay);
  const hubOutDay = pd(sum(per, p => p.hubOut)), hubOutCI = bootMean(p => p.hubOut).map(m => Math.round(m * fullTx / days));
  const allTrDay = pd(sum(per, p => p.allTransfer)), allTrCI = bootMean(p => p.allTransfer).map(m => Math.round(m * fullTx / days));
  const dates = ['2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13'];
  const llamaDays = llama.daily.filter(([d]) => dates.includes(d)); const llamaMean = sum(llamaDays, x => x[1]) / llamaDays.length;
  const classify = acct => /solver/.test(acct) ? 'named solver' : /^[0-9a-f]{64}$/.test(acct) ? 'implicit (hex)' : 'named account';
  const cpList = Object.entries(cp).map(([acct, o]) => ({ acct, class: classify(acct), transfers: o.n, toHubPerDayUsd: pd(o.inUsd), fromHubPerDayUsd: pd(o.outUsd) })).sort((x, y) => (y.toHubPerDayUsd + y.fromHubPerDayUsd) - (x.toHubPerDayUsd + x.fromHubPerDayUsd));
  const cls = {}; for (const c of cpList) { const o = (cls[c.class] ||= { accounts: 0, transfers: 0, toHubPerDayUsd: 0, fromHubPerDayUsd: 0 }); o.accounts++; o.transfers += c.transfers; o.toHubPerDayUsd += c.toHubPerDayUsd; o.fromHubPerDayUsd += c.fromHubPerDayUsd; }
  const flowTable = dir => Object.entries(flowsBy[dir]).map(([chain, o]) => ({ chain, events: o.n, unpricedEvents: o.unpriced, perDayUsd: pd(o.usd) })).sort((x, y) => y.perDayUsd - x.perDayUsd);
  const tdPricedVolPerDay = intentsRes.original.perDay.volumeUsd;
  return {
    note: 'Post hoc. Random sample of intents.near txs from the 168 sampled windows; per-day values = sample mean per tx x full-range tx count / days. HOT Omni (nep245) tokens are unpriced, so values are lower bounds on priced flow. Hub operator unverified.',
    sample: { txs: N, population: S.population, seed: S.seed, fetchedAt: S.fetchedAt, fullRangeTxs: fullTx, days: +days.toFixed(3) },
    txKinds: Object.fromEntries(Object.entries(kind).sort((x, y) => y[1] - x[1]).map(([k, v]) => [k, { n: v, pct: +(v / N * 100).toFixed(1) }])),
    hub: {
      account: HUB, txsCountRange: facts.txsCountRange.hub, shareOfRangeTxsPct: +(facts.txsCountRange.hub / fullTx * 100).toFixed(1), shareOfSampleTxsPct: +(per.filter(p => p.hubInvolved).length / N * 100).toFixed(1),
      onChainAccount: { amountYocto: facts.viewAccount?.amount, codeHash: facts.viewAccount?.code_hash, storageUsage: facts.viewAccount?.storage_usage }, intentsPublicKeys: facts.intentsPublicKeys, oldestTx: facts.oldestTxs?.[0],
      transfersInSample: hubTransfers, transfersWithMemoPct: +(memoCount / (hubTransfers || 1) * 100).toFixed(1), unpricedTransfers: unpricedHub,
      sentPerDayUsd: hubOutDay, sentPerDayCI95: hubOutCI, receivedPerDayUsd: pd(sum(per, p => p.hubIn)),
      counterpartyClasses: cls, topCounterparties: cpList.slice(0, 12),
      medianSentPerHubTxUsd: +(med(per.filter(p => p.hubOut > 0).map(p => p.hubOut)) || 0).toFixed(2),
    },
    allTransfersPerDayUsd: allTrDay, allTransfersPerDayCI95: allTrCI,
    boundaryFlows: { deposits: flowTable('deposit'), withdrawals: flowTable('withdraw'), depositsPerDayUsd: pd(sum(Object.values(flowsBy.deposit), o => o.usd)), withdrawalsPerDayUsd: pd(sum(Object.values(flowsBy.withdraw), o => o.usd)), depositsCI95: bootMean(p => p.dep).map(m => Math.round(m * fullTx / days)), withdrawalsCI95: bootMean(p => p.wd).map(m => Math.round(m * fullTx / days)), largestDepositTxSharePct: +(Math.max(...per.map(p => p.dep)) / (sum(per, p => p.dep) || 1) * 100).toFixed(1), largestWithdrawalTxSharePct: +(Math.max(...per.map(p => p.wd)) / (sum(per, p => p.wd) || 1) * 100).toFixed(1), oneSampledTxEqualsTxsPerDay: Math.round(perTxToDay), pricedEvents: pricedFlow, unpricedEvents: unpricedFlow },
    reconciliation: { defillamaDailyMeanUsd_2026_11_07_to_13: Math.round(llamaMean), defillamaDays: llamaDays, tokenDiffPricedUserVolumePerDayUsd: tdPricedVolPerDay, tokenDiffShareOfDefillamaPct: +(tdPricedVolPerDay / llamaMean * 100).toFixed(2), hubSentShareOfDefillamaPct: +(hubOutDay / llamaMean * 100).toFixed(1), largestHubSentTxSharePct: +(Math.max(...per.map(p => p.hubOut)) / (sum(per, p => p.hubOut) || 1) * 100).toFixed(1), allTransfersShareOfDefillamaPct: +(allTrDay / llamaMean * 100).toFixed(1), defillamaCategory: llama.category, defillamaMethodology: llama.methodologyURL + ' (not read: outside the allowed endpoints)' },
  };
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const r = analyzeCoverage();
  fs.writeFileSync('results/coverage.json', JSON.stringify(r, null, 1));
  console.log(JSON.stringify({ kinds: r.txKinds, hub: { ...r.hub, topCounterparties: r.hub.topCounterparties.slice(0, 6) }, all: [r.allTransfersPerDayUsd, r.allTransfersPerDayCI95], flows: r.boundaryFlows, rec: { ...r.reconciliation, defillamaDays: undefined } }, null, 1));
}
