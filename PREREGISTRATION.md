# NO AUCTION v2: pre-registered hypotheses and kill criteria

Written 2026-11-14 ~10:50 UTC, **after** the collection run started and **before** any of its output was analysed. The collection already running is `scripts/rhea-swaps.mjs 223455000 224500000 … 168 600`. The analyser written next must not change these thresholds.

## Data (fixed)

- **Block range:** 223,455,000 to 224,500,000. That is about 7 days ending 2026-11-14 10:16:12 UTC.
- **Sample:** 168 evenly spaced windows of 600 consecutive blocks each (100,800 blocks, 9.65 % of the range). Each window is contiguous, so execution-order analysis is valid inside it.
- **Scaling:** results are scaled to the full range by the API's full-range transaction counts per DEX account.
- **Venues:** Rhea / Ref v2 (`v2.ref-finance.near`) and DCL (`dclv2.ref-labs.near`). Swaps are parsed from receipt logs, which covers multi-hop swaps, DCL `pool_ids`, and swaps originated by contracts.

## Hypotheses

- **H1 (who captures):** on-chain arbitrage profit is concentrated: the top 3 accounts take more than 50 %.
- **H2 (no sandwiches):** zero confirmed sandwiches. Confirmed means attacker X swaps, then victim Y swaps the same direction, then X swaps back. All three must be on the same pool, in execution order, within 2 blocks, X must profit, and the case must survive manual review.
- **H3 (stakes):** even at 100× the measured scale, on-chain arbitrage profit is under 1 % of annual NEAR issuance (2.5 % × total supply).
- **H4 (validators):** validators capture 0 % of it. This is checked by mechanism: protocol transaction ordering, `burnt_gas_reward` = 0. 30 % of gas burnt in contract calls goes to the contract (the developer reward), not to the validator.

## Kill criteria (each one changes the headline)

| # | If… | then… |
|---|---|---|
| KC1 | fewer than 30 cyclic arbitrage transactions are found in the sample | value capture can't be estimated. Report a 95 % upper bound only, and the headline becomes "too small to measure" |
| KC2 | gross arbitrage profit scales to less than $100/day | headline: "NEAR DEX MEV is negligible", and the NEP-541 discussion is dropped |
| KC3 | one or more confirmed sandwiches | H2 is killed; publish each case with tx hashes |
| KC4 | the top 3 accounts take less than 50 % | H1 is killed |
| KC5 | 100× profit is 1 % of issuance or more | H3 is killed, and NEP-541-style fee capture becomes material |

## Known limits declared in advance

- **CEX-DEX arbitrage** (one-legged trades against Binance) isn't cyclic on-chain. It is estimated separately with 60-second markouts against the Binance NEARUSDT 1-minute close, for wNEAR/stable pools only.
- **Rhea Lend exploit, 2026-04-16:** the DEX was paused as a precaution [secondary]. The week sampled is about 7 months later.
- **Price conversion:** stables are $1. wNEAR uses the Binance 1-minute close. Other tokens are priced at their median rate against wNEAR or stables in the sample.
- **Order within a block:** this uses the API's outcome `index`. That it reflects execution order within the shard's chunk is [to verify].

## Addendum v3: NEAR Intents solver market

Written 2026-11-14 ~14:40 UTC, **after** the Intents collection started (`scripts/intents-swaps.mjs 223455000 224500000 … 168 600`) and **before** any of its output was read. Same range and windows as the Rhea study.

**Data.** Every `dip4:token_diff` entry on `intents.near` in the sampled windows: one signer's side of an executed swap, with its per-token diff, `fees_collected` and `referral`. Scaled to the range by the API's full-range transaction count.

**Definitions (fixed now):**
- **Solver:** an `account_id` that appears in **≥ 20** token_diff entries in the sample. Everyone else is a user.
- **Value at mid:**
  - stables (USDC/USDT on any chain, by contract id) count as $1;
  - NEAR/wNEAR, BTC, ETH and SOL are priced at the Binance 1-minute close (NEARUSDT, BTCUSDT, ETHUSDT, SOLUSDT) at the receipt timestamp;
  - anything else is unpriced, and its share of entries is reported.
- **Solver capture:** the sum over solver entries of the USD value of their net diff. It is positive when solvers gain at mid; it includes hedging P&L they bear elsewhere, so it is an upper bound on margin.
- **User cost:** minus the sum over user entries of the USD value of their net diff.
- **Protocol fees:** the sum of `fees_collected`, valued the same way.

**Hypotheses:**
- **H5:** the auction moved into Intents. Solver capture per day is larger than the Rhea on-chain arbitrage measured above (gross $1,247/day; about $350/day without the spike).
- **H6:** solver capture is concentrated. The top 3 solvers take more than 60 %.
- **H7:** users' cost against mid is mostly solver margin, not protocol fees: solver capture is larger than protocol fees.

**Kill criteria:**

| # | If… | then… |
|---|---|---|
| KC6 | solver capture per day < $350 (Rhea arbitrage without the spike) | H5 is killed. The headline becomes "there is little MEV anywhere on NEAR" |
| KC7 | the top 3 solvers take < 60 % | H6 is killed |
| KC8 | protocol fees ≥ solver capture | H7 is killed. The headline becomes "Intents fees, not solvers, capture most of the value" |
| KC9 | fewer than 200 priced swaps in the sample | estimates are reported as bounds only |

## Addendum v4: outward flows and who pays (project renamed **Yuki**, formerly NO AUCTION / Unbid)

Written 2026-11-14 ~15:35 UTC. The Intents collection was still running, and **none of its output had been read.** The data and definitions are the same as in the v3 addendum.

**Definitions (fixed now):**
- **Foreign-chain asset:** a token id whose contract is a bridged representation of another chain's asset. That means the `*.omft.near` prefixes (`eth-`, `sol-`, `btc`, `base-`, `arb-`, `tron-`, …), the `*.factory.bridge.near` tokens, and `nbtc.bridge.near`.
- **NEAR-side asset:** `wrap.near` and every other token.
- **Net NEAR flow:** the sum over *user* entries of the wNEAR diff, valued in NEAR. A negative number means users sold NEAR on net through Intents.
- **Outward share:** of user swap volume (outgoing side, valued at mid), the fraction whose *incoming* side is a foreign-chain asset while the outgoing side is a NEAR-side asset.

**Hypotheses:**
- **H8:** over the week, users net-sell NEAR through Intents (net NEAR flow < 0).
- **H9:** less than half of user swap volume is outward (NEAR-side → foreign-chain). Most Intents flow is foreign → foreign, so NEAR is the venue, not the source.
- **H10:** users' execution cost against mid (bps) on Intents is lower than Rhea's arbitrage take as a share of Rhea volume (1.54 bps), meaning swapping through Intents costs users less than the arbitrage bleed on the on-chain DEX.

**Kill criteria:**
- **KC10:** net NEAR flow ≥ 0, which kills H8.
- **KC11:** outward share ≥ 50 %, which kills H9.
- **KC12:** Intents user cost ≥ 1.54 bps, which kills H10.

**Not claimed, under any outcome:** that flows show users "leaving NEAR". Swap data can't attribute that.
