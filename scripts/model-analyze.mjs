// Yuki: OFFLINE. Value-accrual model for a long-term NEAR holder. Inputs: fixtures/defillama-accrual.json (daily
// NEAR Intents volume, fees and holders' revenue = the buyback; NEAR gas fees and burn) and the committed results
// (issuance parameters and the week's NEAR price from results/rhea.json; measured user costs from results/intents.json
// and results/hub-quotes.json). Everything is in USD per day; issuance is priced at the study week's median NEAR price.
//  offset(source) = source $/day / issuance $/day, for: Intents buyback, gas burn, on-chain arbitrage (the most an
//  order auction could capture). Breakeven volume = Intents volume/day at which buyback + burn = issuance, at the
//  window's fee rate and holders' share. Post hoc; DefiLlama values are [secondary].
// Run: node --dns-result-order=ipv4first --max-old-space-size=2048 scripts/model-analyze.mjs   -> results/model.json
import fs from 'node:fs';
import { readJson, round } from '../lib/io.mjs';

const DAY = 86400;
const iso = s => new Date(s * 1000).toISOString().slice(0, 10);
const ts = d => Date.parse(d + 'T00:00:00Z') / 1000;

export function analyzeModel() {
  const L = readJson('fixtures/defillama-accrual.json');
  const R = readJson('results/rhea.json'), I = readJson('results/intents.json'), H = readJson('results/hub-quotes.json');
  const S = Object.fromEntries(Object.entries(L.series).map(([k, v]) => [k, new Map(v)]));
  const last = Math.min(...Object.values(L.series).map(v => v.at(-1)[0]));
  const iss = R.original.issuance;
  const price = iss.nearUsdMedian;
  const issuancePerDay = iss.supplyNear * iss.maxInflation / 365 * price;
  const windows = {
    studyWeek: [ts('2026-11-07'), ts('2026-11-13')],
    last30d: [last - 29 * DAY, last],
    last90d: [last - 89 * DAY, last],
    sinceBuyback: [ts('2026-02-23'), last],
  };
  const mean = (k, [a, b]) => { let s = 0, n = 0; for (let t = a; t <= b; t += DAY) { const v = S[k].get(t); if (v != null) { s += v; n++; } } return n ? s / n : null; };
  const arbBaseline = R.extended.robust.exSpikePerDayUsd, arbMean = R.original.cyclicArb.grossPerDayUsd;
  const measuredAllInBps = { tokenDiff: 32.16, treasuryValueWeighted: H.all.totalBps, treasuryRobust: H.robustness?.all.totalBps ?? null };
  const out = {};
  for (const [name, w] of Object.entries(windows)) {
    const vol = mean('intentsVolume', w), fees = mean('intentsFees', w), hr = mean('intentsHoldersRevenue', w), gas = mean('chainGasFees', w), burn = mean('chainGasBurn', w);
    const feeBps = fees / vol * 1e4, holderBps = hr / vol * 1e4;
    const breakevenVol = (issuancePerDay - burn) / (holderBps / 1e4);
    out[name] = {
      from: iso(w[0]), to: iso(w[1]),
      intentsVolumePerDay: Math.round(vol), intentsFeesPerDay: Math.round(fees), intentsFeeBps: round(feeBps, 2),
      holdersRevenuePerDay: Math.round(hr), holdersShareOfFeesPct: round(hr / fees * 100, 1), holdersBpsOfVolume: round(holderBps, 2),
      gasFeesPerDay: Math.round(gas), gasBurnPerDay: Math.round(burn),
      offsetPctOfIssuance: { intentsBuyback: round(hr / issuancePerDay * 100, 2), gasBurn: round(burn / issuancePerDay * 100, 2), arbitrageBaseline: round(arbBaseline / issuancePerDay * 100, 3), arbitrageRegisteredMean: round(arbMean / issuancePerDay * 100, 3) },
      buybackVsBurn: round(hr / burn, 1), buybackVsArbBaseline: round(hr / arbBaseline, 0),
      breakevenIntentsVolumePerDay: Math.round(breakevenVol), breakevenGrowthMultiple: round(breakevenVol / vol, 2),
    };
  }
  const base = out.last30d;
  const holderShareOfUserCost = Object.fromEntries(Object.entries(measuredAllInBps).filter(([, v]) => v != null).map(([k, v]) => [k, round(base.holdersBpsOfVolume / v * 100, 1)]));
  const growth = [1, 2, 3, 5, 10].map(g => ({ volumeMultiple: g, intentsVolumePerDay: Math.round(base.intentsVolumePerDay * g), offsetPctOfIssuance: round((base.holdersRevenuePerDay * g + base.gasBurnPerDay) / issuancePerDay * 100, 1) }));
  const priceSensitivity = [2, price, 6, 10].map(p => ({ nearUsd: p, offsetPctOfIssuance: round((base.holdersRevenuePerDay + base.gasBurnPerDay) / (iss.supplyNear * iss.maxInflation / 365 * p) * 100, 1) }));
  return {
    note: 'Post hoc. DefiLlama series are [secondary]: volume and fees from NEAR-uploaded datasets, holders revenue = NEAR swept into buyback/treasury wallets from 2026-02-23, gas burn estimated by DefiLlama (70 % of gas before protocol v87 on 2026-11-04, 100 % after). Issuance = supply x max inflation, priced at the study week median NEAR price; offsets scale with 1/price.',
    fetchedAt: L.fetchedAt,
    issuance: { supplyNear: iss.supplyNear, maxInflation: iss.maxInflation, nearUsd: price, perDayUsd: Math.round(issuancePerDay), perYearUsd: Math.round(issuancePerDay * 365) },
    measuredAllInBps, holderShareOfUserCostPct: holderShareOfUserCost,
    windows: out, growth, priceSensitivity,
  };
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const r = analyzeModel(); fs.writeFileSync('results/model.json', JSON.stringify(r, null, 1)); console.log(JSON.stringify(r, null, 1));
}
