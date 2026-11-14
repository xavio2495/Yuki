# Yuki: where trading value goes on NEAR, and who pays for it

Written 2026-11-14.

**The papers:** [WHITEPAPER.md](WHITEPAPER.md) (full record and investment thesis) and [PAPER.md](PAPER.md) (litepaper, journal form), by Immanuel and Charles, independent researchers. **The website:** `web/` (Next.js; `cd web && npm install && npm run dev`). **The charts:** [web/public/charts.html](web/public/charts.html), static with no external dependencies; open it in any browser. **Changes after the blind review:** [CHANGELOG-from-review.md](CHANGELOG-from-review.md).

**Headline** (all from `results/*.json`):
- On Rhea, on-chain arbitrage runs at about **$347/day** at baseline. One 6-minute router-driven spike was **72 %** of the week.
- On NEAR Intents `token_diff` swaps, users pay **32 bps** against mid:
  - **24 bps** to integrators;
  - **8 bps** of solver spread (CI includes 0);
  - **0.03 bps** of protocol fee.
- Those swaps are **~1 %** of DefiLlama-reported Intents volume. Much of the rest goes through `51e8f94d…` (46 % of txs), the Treasury of NEAR Intents' private bridge (the swap settles off the public chain). On 194 priced 1Click quotes through it, users pay **≈ 22 bps** all-in, value-weighted (CI 11–51); **≈ 52 bps** on non-stable pairs; **≈ 3.6 bps** on same-asset cross-chain routes.
- **Long-term case:** for a NEAR holder, the only value stream from trading that matters is the Intents-fee buyback: **≈ 18.6 %** of issuance over the last 30 days, ≈ 20× burnt gas and ≈ 170× on-chain arbitrage (the most an order auction could capture). At current rates it would take ≈ 5.3× today's Intents volume to offset issuance. The model re-runs offline (`scripts/model-analyze.mjs`), in the website's sliders, and live in the browser against DefiLlama and NEAR RPC.
- Validators receive nothing from fees. Winning back-runs show no clustering by chunk producer.

## 1. Try it offline (about 5 s, no network, Node ≥ 20; tested on Node 24.18)

```sh
cd yuki
node --dns-result-order=ipv4first --max-old-space-size=2048 scripts/verify.mjs
```

What `verify` does:
1. **Checks SHA-256** of:
   - every fixture against `fixtures/MANIFEST.json`;
   - the uncompressed raw inputs against the hashes the original pack published;
   - `PREREGISTRATION.md` against the hash stated in the whitepaper.
2. **Recomputes every headline number** from `fixtures/` and compares it with `results/*.json`. The tolerance is max(0.01, 1e-6 relative), and the code is deterministic.
3. **Reproduces the original pack's pre-registered numbers.** Tolerances are stated per row.
4. **Checks five labelled transactions:**
   - a known arbitrage;
   - the rejected sandwich;
   - the failed $10k spike clip;
   - the $242.8k Intents swap;
   - the swapkit fee example.

`fetch` is disabled inside `verify`, so any network access fails loudly. The exit code is 0 if everything passes.

**Machine-checked algebra (Lean 4 + Mathlib).** `lean/Yuki/Claims.lean` proves that the same-asset cost needs no prices, that every bps ratio is unchanged by the per-day scale factor, that a value-weighted mean cannot exceed the largest per-quote cost, and the arithmetic behind derived numbers in the prose (0.98 %, ≈ 15×, ≈ 2.6×, the 21.65 bps slice mix). It checks algebra, not measurements. Built 2026-11-14 with Lean v4.36.0-rc2 (no `sorry`):

```sh
cd lean && lake exe cache get && lake build
```

To regenerate every `results/*.json` and `web/public/charts.html` from fixtures (offline, ~8 s):

```sh
node --dns-result-order=ipv4first --max-old-space-size=2048 scripts/rebuild.mjs
```

### Output of `verify`, run here on 2026-11-14

```
== 1. input hashes
PASS  sha256 of 21 fixture files (MANIFEST.json)                               21  vs 21                  
PASS  raw input = pack inputSha256: hops.jsonl                       8fdaf24ecda0  vs 8fdaf24ecda0        
PASS  raw input = pack inputSha256: diffs.jsonl                      a449630465ca  vs a449630465ca        
PASS  PREREGISTRATION.md sha256 (hashed 2026-11-14 16:17:43 UTC)     751ca84ec592  vs 751ca84ec592        
== 2. recomputed from fixtures vs committed results/*.json (tol max(0.01, 1e-6 rel))
PASS  Rhea arb gross $/day                                                1247.13  vs 1247.13             
PASS  Rhea arb 95% CI $/day                                      [216.37, 3084.97]  vs [216.37, 3084.97]   
PASS  Rhea arb bps of priced volume                                          1.54  vs 1.54                
PASS  Rhea priced volume $/day                                         8110743.27  vs 8110743.27          
PASS  Rhea ex-spike baseline $/day                                         347.16  vs 347.16              
PASS  Rhea ex-spike 95% CI $/day                                 [170.82, 564.17]  vs [170.82, 564.17]    
PASS  Rhea spike window share %                                              72.2  vs 72.2                
PASS  Rhea median window $                                                   0.14  vs 0.14                
PASS  Rhea top-3 senders %                                                   50.2  vs 50.2                
PASS  Rhea top-3 senders ex-spike %                                          61.6  vs 61.6                
PASS  Rhea back-run share of profit %                                        39.3  vs 39.3                
PASS  Rhea strict sandwich candidates                                           1  vs 1                   
PASS  Rhea arb gas % of gross                                                2.68  vs 2.68                
PASS  Rhea arb % of max issuance                                           0.3856  vs 0.3856              
PASS  Rhea markout +60s net $/day                                         -940.16  vs -940.16             
PASS  Rhea markout +300s net $/day                                        -515.09  vs -515.09             
PASS  Intents solver capture $/day (token_diff)                           1107.58  vs 1107.58             
PASS  Intents solver capture 95% CI                              [-101.62, 2528.54]  vs [-101.62, 2528.54]  
PASS  Intents priced token_diff volume $/day                           1373172.23  vs 1373172.23          
PASS  Intents solver bps                                                     8.07  vs 8.07                
PASS  Intents app-fee bps                                                   24.07  vs 24.07               
PASS  Intents app fees $/day                                              3304.96  vs 3304.96             
PASS  Intents app fees 95% CI                                    [1145.92, 6334.45]  vs [1145.92, 6334.45]  
PASS  Intents protocol-fee bps                                              0.027  vs 0.027               
PASS  Intents total user cost bps                                           32.16  vs 32.16               
PASS  Intents top swap share of solver capture %                             61.4  vs 61.4                
PASS  Intents top-3 solvers %                                                99.4  vs 99.4                
PASS  Intents outward share % (v4 rule)                                       1.2  vs 1.2                 
PASS  Intents outward share % (omdep fixed)                                   0.8  vs 0.8                 
PASS  Sensitivity: solver bps min..max                             [-1.62, 10.69]  vs [-1.62, 10.69]      
PASS  Sensitivity: app-fee bps min..max                            [18.16, 26.53]  vs [18.16, 26.53]      
PASS  Coverage: token_diff share of DefiLlama %                              0.98  vs 0.98                
PASS  Coverage: hub share of range txs %                                     46.4  vs 46.4                
PASS  Coverage: hub sent $/day (sample)                                  87760078  vs 87760078            
PASS  Coverage: hub sent 95% CI                                  [50146443, 111342109]  vs [50146443, 111342109] 
PASS  Coverage: sample txs with token_diff %                                  0.9  vs 0.9                 
PASS  Chunk producers T1 Monte Carlo p                                     0.5002  vs 0.5002              
PASS  Chunk producers T2 permutation p                                       0.05  vs 0.05                
PASS  Chunk producers T2b (within window) p                                0.2294  vs 0.2294              
PASS  Treasury path: priced swaps (quotes)                                    194  vs 194                 
PASS  Treasury path: all-in user cost bps                                   21.65  vs 21.65               
PASS  Treasury path: all-in 95% CI                                 [10.54, 51.07]  vs [10.54, 51.07]      
PASS  Treasury path: non-stable pairs bps                                   51.78  vs 51.78               
PASS  Treasury path: same-asset cross-chain bps                              3.56  vs 3.56                
PASS  Treasury path: user cost $/day                                        68538  vs 68538               
PASS  Treasury path, extra pairs + USDC at market: all bps                  26.09  vs 26.09               
PASS  Treasury path, extra pairs + USDC at market: stable bps                2.23  vs 2.23                
PASS  Model: issuance $/day at week median price                           323427  vs 323427              
PASS  Model 30d: Intents buyback % of issuance                              18.57  vs 18.57               
PASS  Model 30d: gas burn % of issuance                                      0.93  vs 0.93                
PASS  Model 30d: breakeven Intents volume multiple                           5.33  vs 5.33                
PASS  Model 30d: holders bps of Intents volume                               4.75  vs 4.75                
PASS  Model: holders share of measured user cost %                           21.9  vs 21.9                
PASS  Model: NEAR accumulated in revenue wallets, % of issuance             15.04  vs 15.04               
PASS  Model: buyback wallet NEAR per day                                     9691  vs 9691                
PASS  Chunk producers, full week: winners tested                              500  vs 500                 
PASS  Chunk producers, full week: T1 Monte Carlo p                           0.08  vs 0.08                
PASS  Chunk producers, full week: T2 permutation p                           0.02  vs 0.02                
PASS  Chunk producers, full week: T2b (within window) p                    0.2284  vs 0.2284              
== 3. reproduced vs the original pack results JSON
PASS  Rhea cyclic arbs (count)                                               1652  vs 1652                tol 0
PASS  Rhea gross $/day                                                    1247.13  vs 1247.13             tol 0.005
PASS  Rhea CI                                                    [216.37, 3084.97]  vs [216.37, 3084.97]   tol 0.005
PASS  Rhea top-3 %                                                           50.2  vs 50.2                tol 0
PASS  Rhea sandwich candidates                                                467  vs 467                 tol 0
PASS  Rhea strict sandwiches                                                    1  vs 1                   tol 0
PASS  Rhea volume $/day (tol 0.5%: metadata refetched)                 8110743.27  vs 8092272.54          tol 40461.3627
PASS  Rhea % of issuance (tol 0.01: median price window fixed)             0.3856  vs 0.3858              tol 0.01
PASS  Intents solver $/day                                                1107.58  vs 1107.58             tol 0.005
PASS  Intents solver CI                                          [-101.62, 2528.54]  vs [-101.62, 2528.54]  tol 0.005
PASS  Intents bps user/solver/fees                               [8.09, 8.07, 0.03]  vs [8.09, 8.07, 0.03]  tol 0.005
PASS  Intents top-3 solvers %                                                99.4  vs 99.4                tol 0
PASS  Intents net NEAR flow/day                                               -77  vs -77                 tol 0
PASS  Intents outward share %                                                 1.2  vs 1.2                 tol 0
== 4. labelled transactions
PASS  arb ZNRqvoRq... walrus1.near, 3-hop cycle, profit $                   36.31  vs 36.31               
PASS  strict sandwich candidate: attacker MM, victim zoe1.near        13789 swaps  vs >10000 swaps        rejected on review
PASS  spike: first router clip CsRY5e4F... $10k, failed            10000 ok=false  vs 10000 ok=false      
PASS  swap FQcNTHHq... $242.8k: solver $455.61 + app fee $                 243.04  vs 243.04              
PASS  swap FWpiMSDB... (1click-swapkit): app fee > 10x solver           725 vs 42  vs >10x                
PASS  quote e464353c... $57k NBTC->USDT via Treasury, all-in bps            21.71  vs 21.71               

83 passed, 0 failed, 7.3 s, node v24.18.0, network: none
```

## 2. Full online rebuild (read-only public APIs; about 70 min for collection)

```sh
N="node --dns-result-order=ipv4first --max-old-space-size=2048"
# 1. collect (FastNEAR explorer API), fixed block range, 168 windows x 600 blocks
$N scripts/rhea-swaps.mjs    223455000 224500000 data/run-223455000-224500000     168 600
$N scripts/intents-swaps.mjs 223455000 224500000 data/intents-223455000-224500000 168 600
# 2. fixtures: token metadata (NEAR RPC) + Binance 1m closes; Intents swap events; hub sample; DefiLlama
$N scripts/build-fixtures.mjs rhea    data/run-223455000-224500000
$N scripts/build-fixtures.mjs intents data/intents-223455000-224500000
$N scripts/intents-fetch-events.mjs data/intents-223455000-224500000/diffs.jsonl fixtures/intents-swap-events.json && gzip -9f fixtures/intents-swap-events.json
$N scripts/hub-fetch.mjs data/intents-223455000-224500000/hashes.json 2000
$N scripts/hub-quotes-fetch.mjs   # per-quote lifecycles through the Treasury, ~10 min
$N scripts/hub-quotes-klines.mjs  # extra Binance pairs for the robustness block, ~1 min
$N scripts/llama-fetch.mjs        # DefiLlama daily series for the value-accrual model, seconds
$N scripts/wallets-fetch.mjs 220090000   # revenue-wallet balances ~30 days apart, archival RPC
$N scripts/chunk-fetch.mjs 223455000 https://archival-rpc.mainnet.fastnear.com,https://archival-rpc.mainnet.near.org fixtures/chunk-authors-fullweek.json 1500 300   # full-week chunk authors, ~2 h (rate-limited)
curl -s https://api.llama.fi/summary/dexs/near-intents > /tmp/llama.json   # then trim into fixtures/defillama-near-intents.json (format: see that file)
# 3. copy raw data into fixtures (gzip), analyse, optional chunk-producer test, page, manifest
gzip -9c data/run-223455000-224500000/hops.jsonl      > fixtures/data/run-223455000-224500000/hops.jsonl.gz
gzip -9c data/intents-223455000-224500000/diffs.jsonl > fixtures/data/intents-223455000-224500000/diffs.jsonl.gz
$N scripts/rhea-analyze.mjs && $N scripts/chunk-fetch.mjs && $N scripts/rebuild.mjs
```

Notes:
- **Collection is resumable.** The collector logic is unchanged from the pack; only the headers and paths were fixed.
- **`chunk-fetch.mjs` needs archival chunks.** On 2026-11-14 `near.drpc.org` served only heights ≥ ~224,351,686, so the test is restricted to the last ~23 windows.
- **A rerun may differ slightly.** Token metadata and klines fetched at a different time can shift results, so the committed fixtures are the reference.

## 3. Claim → evidence → command

| # | Claim (whitepaper §) | Number | File → field | Command |
|---|---|---|---|---|
| 1 | Rhea arbitrage baseline without the spike (§5.1) | $347/day, CI $171–564 | `results/rhea.json` → `extended.robust.exSpikePerDayUsd`, `exSpikeCI95PerDayUsd` | `verify` §2 |
| 2 | Pre-registered Rhea arbitrage estimate (§5.1) | $1,247/day, CI $216–3,085, 1.54 bps | `rhea.json` → `original.cyclicArb` | `verify` §2, §3 |
| 3 | Spike share; median window (§5.1) | 72.2 %; $0.14 | `rhea.json` → `extended.robust` | `verify` §2 |
| 4 | First spike clip $10k failed (§5.1) | tx `CsRY5e4F…` | `rhea.json` → `extended.spike.routerFirst10[0]` | `verify` §4 |
| 5 | Operator concentration (§5.1) | top-3 50.2 % (61.6 % ex-spike) | `rhea.json` → `original.cyclicArb.top3SharePct`, `extended.concentration` | `verify` §2 |
| 6 | Back-runs' share of profit (§5.1) | 39.3 % | `rhea.json` → `original.backruns.sharePct` | `verify` §2 |
| 7 | 0 confirmed same-pool sandwiches (§5.1, KC3) | 1 strict candidate, rejected | `rhea.json` → `original.sandwiches.strictList` | `verify` §4 |
| 8 | CEX-DEX markouts; persistent winners (§5.1) | −$940 / −$515 per day; ~$1,000/day | `rhea.json` → `extended.markout` | `verify` §2 (60 s, 300 s) |
| 9 | Arbitrage share of max issuance; KC5 (§7, App. B) | 0.3856 %; 100× = 38.6 % | `rhea.json` → `original.issuance` | `verify` §2 |
| 10 | Intents user-cost stack (§5.3) | 24.07 + 8.07 + 0.027 = 32.16 bps | `results/intents.json` → `extended.stack` | `verify` §2 |
| 11 | App fees $/day and CI (§5.3) | $3,305, CI $1,146–6,334 | `intents.json` → `extended.stack.appFeePerDayUsd`, `appFeeCI95` | `verify` §2 |
| 12 | Solver capture and CI (§5.3, KC6) | $1,108, CI −$102–2,529 | `intents.json` → `original.perDay` | `verify` §2, §3 |
| 13 | One swap = 61 % of solver capture (§5.3) | `FQcNTHHq…` | `intents.json` → `extended.fragility` | `verify` §4 |
| 14 | Fees by trade size and by integrator (§5.3) | e.g. < $100: 117 bps; swapkit 111 bps app fee | `intents.json` → `extended.bySize`, `extended.byIntegrator` | `rebuild` (deterministic) |
| 15 | Solver-rule sensitivity (§5.3) | solver −1.6…10.7 bps; app fee 18.2…26.5 bps | `intents.json` → `sensitivity` | `verify` §2 |
| 16 | Outward flows, registered vs omdep-fixed (§5.5, KC11) | 1.2 % / 0.8 % | `intents.json` → `original.flows`, `extended.flowsFixedOmdep` | `verify` §2 |
| 17 | Ledger deposits and withdrawals by chain (§5.5) | ~$163M / ~$73M per day (wide CIs) | `results/coverage.json` → `boundaryFlows` | `rebuild` |
| 18 | Coverage: token_diff = 0.98 % of DefiLlama (§7) | $1.37M vs $140.0M/day | `coverage.json` → `reconciliation` | `verify` §2 |
| 19 | Hub `51e8f94d…` (= Private PoA Bridge Treasury, docs): 46 % of txs; $88M/day sent, bridge flow not trades (§11) | CI $50–111M | `coverage.json` → `hub` | `verify` §2 |
| 20 | No chunk-producer clustering, full week (§5.2): 500 winning back-runs | T1 p = 0.08; T2b p = 0.23 (partial run: 0.50 / 0.23) | `results/chunk-producers-fullweek.json` (partial: `chunk-producers.json`) | `verify` §2 |
| 21 | KC outcomes under pricing exactly as registered (App. B) | unchanged | `intents.json` → `pricingAsRegistered` | `rebuild` |
| 22 | Pre-registration unchanged since 2026-11-14 16:17:43 UTC (App. C) | sha256 `751ca84e…` | `PREREGISTRATION.md` | `verify` §1 |
| 23 | Validator fee share 0: `burnt_gas_reward` [0,1], `validator_reward` "0" (§2) | live config | RPC `EXPERIMENTAL_protocol_config` / `block` at 224,412,990 | online only (one RPC call each; not in fixtures) |
| 24 | Treasury-path all-in user cost, 194 priced 1Click quotes (§5.4) | 21.65 bps (CI 10.54–51.07); ≈ $69k/day | `results/hub-quotes.json` → `all`, `perDay` | `verify` §2 |
| 25 | Treasury path: non-stable pairs (§5.4) | 51.78 bps (CI 32.58–132.66) | `hub-quotes.json` → `other` | `verify` §2 |
| 26 | Treasury path: same-asset cross-chain, price-free (§5.4) | 3.56 bps (CI 2.22–7.23) | `hub-quotes.json` → `sameAssetCrossChain` | `verify` §2 |
| 26b | Robustness: extra Binance pairs, USDC at market (§5.4) | 26.09 bps all; 2.23 bps stable → stable | `hub-quotes.json` → `robustness` | `verify` §2 |
| 27 | Labelled quote `e464353c…`: $57k NBTC → USDT, shield → release in 9 s → withdraw (§5.4) | 21.71 bps | `hub-quotes.json` → `quotes` | `verify` §4 |
| 28 | Value accrual, last 30 days: Intents buyback = 18.57 % of issuance; gas burn 0.93 % (§6) | $60,071/day buyback vs $323,427/day issuance at $3.60 | `results/model.json` → `windows.last30d` | `verify` §2 |
| 29 | Breakeven: buyback + burn = issuance at 5.33× the 30-day Intents volume (§6) | ≈ $675M/day | `model.json` → `breakevenGrowthMultiple` | `verify` §2 |
| 30 | Holders get 4.75 bps of volume = 21.9 % of measured all-in user cost (confidential path) (§6) | 14.8 % on public swaps | `model.json` → `holderShareOfUserCostPct` | `verify` §2 |
| 31 | Buyback wallets exist: `buybacks.multisignature.near` ≈ 2.29 M NEAR, appears in 3,416 transactions (mostly receiving) (§6) | 2026-11-14 ~19:30 UTC | NEAR RPC `view_account`, FastNEAR `/account` | online only |
| 32 | NEAR accumulated in revenue wallets over 30.26 days: 13,509 NEAR/day = 15.04 % of issuance (buyback wallet 10.79 %, fee wallet 4.25 %) (§6) | blocks 220,090,000 → 224,566,803 | `fixtures/buyback-wallets.json` → `results/model.json` `walletAccumulation` | `verify` §2 |

## 4. Layout

| Path | What |
|---|---|
| `WHITEPAPER.md`, `PAPER.md` | The whitepaper (full record) and the litepaper |
| `PREREGISTRATION.md` | Hypotheses and kill criteria (v1, v3, v4), byte-identical to the pack |
| `lib/rhea.mjs`, `lib/intents.mjs` | Pure analysis functions. The "original" parts are ports of the pack's analysers and reproduce its numbers; the "extended" parts are post hoc |
| `lib/io.mjs`, `lib/shards.mjs` | Helpers: gzip-aware I/O, the seeded bootstrap, shard assignment |
| `scripts/*-analyze.mjs` | Offline analysers → `results/` |
| `scripts/verify.mjs`, `scripts/rebuild.mjs`, `scripts/manifest.mjs`, `scripts/build-web.mjs` | Offline tooling |
| `scripts/rhea-swaps.mjs`, `scripts/intents-swaps.mjs`, `scripts/build-fixtures.mjs`, `scripts/intents-fetch-events.mjs`, `scripts/hub-fetch.mjs`, `scripts/hub-quotes-fetch.mjs`, `scripts/hub-quotes-klines.mjs`, `scripts/chunk-fetch.mjs` | Online collectors (read-only) |
| `fixtures/data/*/` | Raw sampled data (gzip) plus counts and meta. SHA-256 of the uncompressed files = the pack's |
| `fixtures/*.json` | Token metadata, Binance 1-minute closes, Intents swap events, hub sample, DefiLlama snapshot, chunk authors |
| `results/` | Committed outputs (`rhea-winning-backruns.json` is an intermediate for `chunk-fetch.mjs`) |
| `web/` | Website (Next.js bento; papers in the reader). `web/public/charts.html`: chart page (inline SVG; hover for values; a table under each chart) |
