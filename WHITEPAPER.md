# Yuki: Where Trading Value Goes on a Chain That Does Not Sell Transaction Order

**A long-term investment thesis for NEAR, judged on reproducible evidence**

Immanuel and Charles, independent researchers

2026-11-14

---

## Abstract

NEAR does not sell transaction order: it has no priority fee, burns its transaction fees and pays validators from issuance. For a long-term holder the question is therefore where the value of trading goes, and whether any of it returns to the token. Measuring one week of mainnet activity and setting each stream that reaches holders against issuance, we find that, of the streams we measured, only one is large against issuance. The share of intent-system fees swept into NEAR buyback and revenue wallets accumulates on chain, where it is held, not burned. Order-based extraction and burnt gas are one to two orders of magnitude smaller, and validators receive no share of fees. Users pay mainly for distribution: application and routing fees on public intent swaps, and a fee layer of similar size on the confidential route that the public chain cannot split. Holders keep a minority of what users pay, and matching issuance in size would take a severalfold rise in intent volume at today's rates. The buyback is a policy rather than a protocol rule, which is the main risk to the thesis. This paper states the evidence for the thesis, the evidence against it, and the observations that would change our mind; the results computed from the sampled data are recomputed offline from public data.

**How to read the labels.** Every factual claim carries one of these marks:

- **[measured]**: computed in this work from on-chain data.
- **[verified]**: a primary source that we read.
- **[spec]**: protocol specification or live configuration.
- **[secondary]**: a third-party aggregate or report.
- **[judgment]**: our opinion.
- **[to verify]**: not confirmed.

Numbers in square brackets, such as [4], point to the reference list. All dates are absolute and in UTC.

---

## Key findings

The study covers one week of NEAR mainnet, from 2026-11-07 to 2026-11-14, read through a systematic sample of block windows and scaled to the week (Section 4). Dollar values use an external exchange price at the minute of each transaction.

1. **Order-based extraction is small.** On the on-chain exchange Rhea, cyclic arbitrage earns about **$347 a day** outside one six-minute event (95 % CI $171–564), and $1,247 a day with it (95 % CI $216–3,085). That is 0.11 % and 0.39 % of NEAR's issuance. Three accounts take half of the profit. We confirmed no sandwich attack of the same-pool shape we searched for [measured].
2. **Validators receive no fee share, and we detect no share through ordering.** Transaction fees are burnt, and the validator reward is zero in every chunk header of the one block we inspected [measured]. Across the week, the producers of the chunks that included 500 winning back-runs show no significant clustering once time is controlled (a borderline p = 0.08 against the producer schedule, p = 0.23 against failed attempts by the same bots within the same window) [measured].
3. **On the public route of NEAR Intents, users pay about 32 bps, mostly to applications.** The cost is 24.07 bps of fees to the integrators that route the order, 8.07 bps of solver spread whose interval includes zero, and 0.027 bps of protocol fee [measured]. This route is only about 1 % of the volume reported for NEAR Intents.
4. **On the confidential route, users pay about 22 bps all-in.** On 194 priced quotes the value-weighted cost is 21.65 bps (95 % CI 10.54–51.07). It is 51.78 bps outside stablecoin and same-asset routes and 3.56 bps on same-asset routes across chains. The typical quote is small and pays about 55 bps. The public chain cannot show how this cost divides between fees and solver spread [measured].
5. **The stream that reaches holders is the Intents fee layer.** On chain, NEAR accumulated in the buyback and revenue wallets at about 13.5k NEAR a day over 30 days, **15.0 % of issuance**, a figure that needs no price and no label [measured]. DefiLlama attributes $60.1k a day to this flow, 18.6 % of issuance [secondary]. Purchases that are visible on chain as swaps are a lower bound of about 2.7 % [secondary]. Burnt gas is 0.9 % of issuance.
6. **Holders receive a minority of what users pay.** Holders' revenue is 4.75 bps of Intents volume, roughly 15–22 % of the user's all-in cost on the two routes. The numerator is a 30-day aggregate and the costs are one week's samples, so the share is approximate. Integrators, the 1Click routing service and solvers keep the rest.
7. **About 5.3 times today's volume would match issuance in size.** At the fee rate and holders' share of the last 30 days, buyback and burn together equal issuance at about $675M of Intents volume a day [secondary inputs, our arithmetic]. The buyback NEAR is held in wallets, not burned, so this is a comparison of flows and not a net change in supply.
8. **The stream is policy, not protocol.** The share swept to holders is set by the ecosystem and can be cut. Since the buyback began on 2026-02-23 it has averaged 9.6 % of issuance, about half of the last 30 days' level. A governance decision, HSP-029, would lower the issuance ceiling from 2.5 % to 1.6 %; it is not yet in force [secondary].

**Bottom line** [judgment]. The long-term case for NEAR from trading is a bet that Intents volume grows and that its fee layer keeps paying holders. It is not a bet on selling blockspace or transaction order, which today would capture well under 1 % of issuance.

---

## 1. The thesis

### 1.1 The question

On NEAR, nobody can buy transaction order through the protocol: there is no priority fee, no builder market and no tip. Value from trading does not disappear on such a chain. Arbitrage still closes price gaps, informed traders still trade against stale quotes, and users still pay for routing. The question is where that value goes once the auction is removed, and who pays for it.

### 1.2 The claim

Our claim has four parts. The first three are measurements, and the fourth is the investment case that follows from them.

1. Order-based extraction is small and goes to a few bots, not to validators.
2. What users pay for trading is a distribution fee, not extraction by ordering.
3. Most Intents volume settles off the public chain, but its all-in cost to users can still be measured from the public legs.
4. NEAR's value accrual from trading runs through the Intents fee layer, not through blockspace or transaction order.

### 1.3 The investable quantity [judgment]

For a holder, the quantity to underwrite is the product

> **Intents volume × fee rate × holders' share.**

Gas burn and order-based extraction are one to two orders of magnitude smaller than this product today (Section 6). Three consequences follow for someone holding NEAR for years.

- **What the design gets right.** Transaction order is not sold, so users are not taxed by searchers, and validators are paid from issuance, not from users' trades. Trading stays cheap at the base layer, and value capture moves to a layer that the protocol's ecosystem controls.
- **Where the value sits.** The fee layer of NEAR Intents collects what users pay. The part swept into NEAR is the only trading stream that is material against issuance.
- **Where the risk sits.** The buyback is a policy. Most volume settles on a confidential ledger whose fee split the public chain cannot show. The other 78–85 % of what users pay stays with integrators, 1Click and solvers; this share sets a 30-day aggregate against costs sampled in one week, so it is approximate. The thesis is only as durable as the share that reaches holders.

### 1.4 What this paper does not claim

We do not measure whether users are leaving or joining NEAR, and no statement here should be read that way. Swap and withdrawal data cannot say whether a person stopped using a chain. Intents users mostly appear as one-time accounts with 64-character hexadecimal names: one account, the bridge treasury of Section 2.3, makes 1,410 transfers in our sample, and 612 of them involve 586 distinct accounts of this kind, almost all seen once [measured]. No identity links them across trades. The pre-registration ruled out any such claim in advance. We report what users pay, and which assets flow across the ledger boundary, as facts.

---

## 2. Mechanism: how NEAR handles order, fees and trading

### 2.1 Ordering

Chunk producers choose which transactions to include and in what order. The default node software iterates its transaction pool round-robin by signer and access key. Receipts in a chunk then execute in an order set by the protocol: local, then delayed, then incoming. There is no priority fee field and no tip, so there is no in-protocol channel to pay for position. Validators do not check the order of transactions inside a chunk. "Not for sale" is therefore a statement about the protocol and the default software, not about what is impossible [spec, judgment].

### 2.2 Fees and validator pay

Gas is burnt [11]. We read the live mainnet configuration at block 224,412,990 (protocol version 88) [measured]:

- the share of burnt gas paid to the called contract (the developer reward, formerly 3/10) is 0;
- the protocol reward rate is 0;
- the maximum inflation rate is 1/40, or 2.5 % a year.

Governance removed the developer reward by proposal HSP-027 [13] [secondary]. Every chunk header in that block reports a validator reward of zero next to a non-zero burnt balance [measured]. Validators are paid from issuance through epoch rewards, not from fees [spec].

### 2.3 Venues

Trading value on NEAR sits in two venues.

**Rhea** is the on-chain automated market maker, made of the pool contracts `v2.ref-finance.near` and `dclv2.ref-labs.near`. Its pools are visible swap by swap, and arbitrage shows up as cycles of swaps that start and end in the same token.

**NEAR Intents** is a ledger at `intents.near` on which users sign what they want and professional solvers fill it. A signed intent settles on one of two routes.

- **Public route.** The user signs a `token_diff` intent, a statement of the balance changes the user accepts. Solvers sign matching diffs in the same transaction, and the contract enforces that the diffs and fees sum to zero for every token. Everything is visible on chain.
- **Confidential route.** The user's deposit moves into a bridge treasury, the swap settles on a second ledger, `intents.far`, that public indexers cannot read, and the treasury releases the output back. The documentation of NEAR Intents names the account `51e8f94d…7cbe` as the Treasury of the Private PoA Bridge: "A transfer on `intents.near` moves them to the Treasury account … with a memo naming the recipient. The Private PoA Bridge sees that transfer and mints the same amount on `intents.far` … Moving back is the reverse … and the Treasury releases on `intents.near`" [14] [verified, read 2026-11-14]. The swap itself "settles entirely on FAR via a `token_diff` intent, invisible to public indexers" [14]. The documentation does not name a legal operator.

Most orders reach either route through **1Click**, a routing service that wallets and aggregators integrate. We call those wallets and aggregators **integrators**. They can add their own fee, an **app fee**, to each order.

### 2.4 The fee layer and the revenue wallets

The documented fee schedule has three parts [15] [verified that the documentation states these rates]: a protocol fee of 0.0001 % collected by `intents.near`; a 1Click fee of 20 bps by default, and 1 bp for stablecoin pairs and same-asset routes across chains; and the integrators' app fees on top.

Part of the fee revenue is swept into NEAR held by three accounts, which the NEAR revenue dashboard lists as revenue wallets [18]: `buybacks.multisignature.near`, `fefundsadmin.sputnik-dao.near` and `1csfundsadmin.sputnik-dao.near`. DefiLlama states that since 2026-02-23 the captured Intents revenue buys NEAR on the open market and that the NEAR is not burned [16] [secondary]. We refer to this flow as the **buyback**, and to its recipients as **holders** in the sense that NEAR moves into wallets aligned with the token. That NEAR is held, not burned and not distributed, and the parties that control the wallets can spend it. Section 6 states what is and is not verified about it.

---

## 3. Prior work

**Ordering markets and extractable value.** Value extracted by ordering transactions was first measured on a chain where order is sold: bots bid fees against each other for position, and the payment goes to block producers [1]. Later work quantified such extraction across arbitrage, liquidations and sandwich attacks [2] and formalized the sandwich attack on automated market makers [3]. These studies observe extraction through the payment for order. A chain without an order market leaves no such payment to observe.

**Arbitrage and the cost of liquidity.** Arbitrage against an automated market maker can be valued against an external price, which separates what liquidity providers lose to arbitrageurs from their market exposure [4]. Arbitrage between a decentralized exchange and venues off the chain is a large share of volume on the main exchanges of one chain [5]. We adopt the external price as the yardstick. Neither study rebuilds swaps from execution receipts on a sharded chain.

**Intent and solver markets.** In intent-based exchanges, solvers compete to fill signed orders. Entry costs can make a small set of solvers the welfare-preferred outcome [6], auction-based interfaces improve prices by a few basis points [7], execution quality differs across platforms and pairs [8], and changing how solvers are paid shifts concentration [9]. These studies measure competition on public settlement. They do not separate what the user pays to the applications that route the order, and they do not measure settlement that leaves the public ledger.

**Fee burning and value accrual.** Burning a protocol fee is analyzed as a mechanism-design choice [10]. For NEAR, a closed proposal to add a transaction priority fee shows that selling order was considered and not adopted [12]. Concurrent analyses report the fee rate users paid on NEAR Intents from an aggregator's series [20], trace the buyback's purchases on chain [21], and sample the ledger and its quotes [23], [24]. What was missing is one account that values each layer of trading against an external price and sets what reaches holders against issuance, with every step re-runnable.

---

## 4. Data and measures

This section defines the units used in the evidence. Section 10 gives the full method.

**Range and sample.** The range is NEAR mainnet blocks 223,455,000 to 224,500,000, about 7.0 days from 2026-11-07 10:16 to 2026-11-14 10:16 UTC. We read a systematic sample of 168 evenly spaced **windows** of 600 consecutive blocks each, which is 9.65 % of the blocks. Per-day figures scale the sample to the range by the full-range transaction count of the contract concerned.

**Prices.** Token amounts are valued at the Binance one-minute price at the time of the transaction, and dollar stablecoins at $1 unless stated. A **basis point** (bps) is one hundredth of one percent of the priced volume.

**Uncertainty.** Intervals are 95 % percentile intervals from 2,000 bootstrap resamples, with fixed seeds, over windows or over quotes.

**The four measures.**

- **Cyclic arbitrage**: a transaction whose swaps start and end in the same token. Its gross profit is the value of its net token change. A **back-run** is a cyclic arbitrage that is the next swap on a pool within one block after a swap that is not an arbitrage.
- **User cost on the public route**: app fees, plus solver spread, plus protocol fee. App fees are transfers signed under the user's own intent to an account that is not a counterparty of that swap. Solver spread is the solvers' net balance change valued at mid.
- **All-in cost on the confidential route**: (value sent to the treasury − value released back) / value sent, both valued at the price of the release, so market drift between the two steps is excluded.
- **Offset of issuance**: a stream reaching holders, in dollars a day, divided by issuance in dollars a day. It compares sizes. Only burnt gas reduces supply; NEAR in the revenue wallets remains in supply.

**Pre-registration.** Hypotheses and kill criteria were registered in three stages on 2026-11-14; the first stage was written after a short pilot. Appendix B lists every outcome and Appendix C every departure. Analyses added afterwards are marked post hoc.

---

## 5. Evidence for

### 5.1 On-chain arbitrage is small and concentrated

We parsed every swap hop from receipt logs, so multi-hop swaps and swaps started by contracts are included. The sample holds 65,203 hops, of which 48,210 succeeded, in 41,762 transactions. Priced Rhea volume is $8.11M a day, a lower bound because 247 launchpad tokens have no price [measured].

**TABLE 1.** Cyclic arbitrage on Rhea, gross, scaled to the week [measured].

| Measure | Value |
| --- | --- |
| Baseline, excluding the single spike window (post hoc) | **$347/day** (95 % CI $171–564), 0.44 bps of volume |
| Same, excluding the top two windows | $299/day |
| Pre-registered estimator, all windows | $1,247/day (95 % CI $216–3,085), 1.54 bps |
| Median window | $0.14 of profit; 133 of 168 windows had any |
| Arbitrages in the sample | 1,652 (about 2,570 a day); 62 lost money; gas is 2.68 % of gross |
| Failed attempts | 8,380 transactions whose swap receipts all failed (about 13k a day); their gas is $79/day, 6.4 % of gross profit |

**One window holds most of the week.** The window that starts at block 224,412,917 (2026-11-13, about 20:20 UTC) holds 72.2 % of the sampled profit; the next two hold 3.9 % and 3.7 %. The NEAR price on Binance was flat at $3.537–3.549 throughout, so this was not a market-wide move. A contract router pushed size through thin pools of one token, and bots closed the gaps it opened in 138 arbitrages. Our reading is that the bots competed by speed and retries, not by paying for order [judgment]. Appendix A.1 gives the anatomy of the event.

**Profit is concentrated.** By sender, the top three accounts take 50.2 % of profit over all windows and 61.6 % outside the spike. One family of accounts named in the pattern `<name>1.near` takes 38.2 % (20.2 % outside the spike); this grouping is by name only [judgment]. The leaders differ between the spike and the baseline, so "concentrated" is robust while the identity of the leader depends on the event (Appendix A.2).

**Back-runs.** 647 arbitrage transactions were back-runs. They earned 39.3 % of profit, and 505 of them were profitable. These 505 winners feed the validator test in Section 5.2.

**Sandwiches.** We found 467 patterns of the form attacker, victim, attacker on the same pool, in execution order, within two blocks. They are dominated by market makers interleaving with each other. One pattern passes the strict filter, and we reject it on review: its profit is $0.00025, the "attacker" is a market maker with 13,789 swaps, and the "victim" belongs to the bot family above. That review is post hoc. The result is zero confirmed sandwiches of this shape. Sandwiches across several pools or routes were not searched.

**Scale against issuance.** Baseline arbitrage is 0.11 % of issuance and the all-window mean is 0.39 %. These are upper bounds on what an order auction could capture from on-chain arbitrage today.

### 5.2 Validators receive no fee share and show no detectable preference

**Mechanism.** Fees are burnt, the validator reward is zero in the chunk headers of the block we inspected, and there is no tip field (Section 2.2).

**Empirical check (post hoc).** If some chunk producers sold order outside the protocol, winning back-runs should be over-represented in their chunks. We tested this on the full week, in all 168 windows, with chunk authors read from two archival nodes that returned identical results. The test covers 500 of the 505 winning back-runs, 1,431 failed attempts by the same bots, and 300 random block heights across 8 shards as the reference. Each of these needs a lookup of the chunk that included it. Of the 4,755 lookups, 170 (3.6 %) failed after retries and are left out [measured].

- **Against the producer schedule.** Comparing the producers of the chunks that included the winners with each shard's producer mix gives χ² = 84.6 and a Monte Carlo p of 0.08. This is not significant at 5 %. The largest cell is 1.23 times its expected count.
- **Against failed attempts by the same bots.** Permuting labels within shard gives p = 0.02. Permuting within shard and window, which controls for the producer schedule changing across epochs, gives p = 0.23.
- **Spread.** The 500 winners fall on 57 distinct producers. In 5 of 500, the producer that included the transaction also executed it.

**Reading** [judgment]. We detect no producer-level clustering once time is controlled. The shard-only signal disappears within windows, which points to schedule rotation over the week and not to producers favoring particular bots. The first test is borderline and is reported as such. This is evidence against paid ordering over the week. It is not proof that no order is ever sold.

### 5.3 On the public Intents route, users pay mostly app fees

**Scope.** The sample holds 957 swaps that settle by `token_diff`, of which 406 are fully priced and have a solver. Priced user volume is $1.37M a day. Another 534 swaps include tokens without a price; their priced legs carry about $44k a day [measured].

**TABLE 2.** What users pay on the public route, against the Binance one-minute mid [measured; the app-fee layer is post hoc].

| Layer | $/day | bps of priced user volume | 95 % CI ($/day) |
| --- | --- | --- | --- |
| Integrator and app fees | $3,305 | **24.07** | $1,146–6,334 |
| Solver spread at mid | $1,108 | 8.07 | −$102 to $2,529 |
| Protocol fee | $3.72 | 0.027 | n/a |
| **Total user cost** | **$4,416** | **32.16** | $1,416–7,873 |

The app fees are 496 transfers in 260 of the 406 swaps. The total equals solver capture plus fees by construction, because the contract enforces it per token; that identity is a sanity check, not a finding.

**App fees dominate under every rule.** Under every definition of a solver that we tried, app fees stay between 18 and 27 bps while solver spread moves between −1.6 and 10.7 bps. Capping each fee transfer at 200 bps of its swap gives 23.32 bps (Appendix A.4).

**Fees are regressive in trade size.** Swaps under $100 pay 117.1 bps in total, and the two swaps of $100k or more pay 17.3 bps (Appendix A.3).

**The front end sets the cost.** Grouped by referral tag, the app fee runs from about 1.8 bps on one aggregator to 111.1 bps on another (Appendix A.3). The cost to users is set mostly by which front end they use, not by solvers [judgment].

**Solver spread is fragile.** One swap of $242,799 contributes 61.4 % of it. The top five swaps sum to 109 %, and 139 swaps are negative for solvers. Without the top swap, solver spread is $427 a day (4.2 bps). The interval in Table 2 includes zero.

**Who receives the app fees.** There are 48 recipient accounts, and their identities are unverified. The largest, `c4d748df…`, receives $1,818 a day through one integrator at a median of 140 bps. Two others take a small flat cut across many integrators: `5880ad2b…` at a median of 1.0 bps ($415 a day) and `143f2bb4…` at a median of 1.4 bps. A small, flat take across integrators looks like a platform-level cut [judgment, unverified]. A concurrent analysis reports that NEAR has kept about 27 % of fees since the fee switch [20] [secondary].

### 5.4 On the confidential route, users pay a fee layer of similar order

**Why this route matters.** The treasury account of Section 2.3 appears in 46 % of all transactions of `intents.near` in the range [measured]. The public route of Section 5.3 is about 1 % of reported volume. Most of the system's activity therefore passes through the treasury.

**What is public.** Each 1Click quote uses a fresh account. On `intents.near` we see four steps:

1. the deposit from the origin chain is minted to the account;
2. the account transfers the whole deposit to the treasury, with an opaque memo (the shield);
3. a median of 8.3 s later, the treasury transfers the output token back to the same account (the release);
4. the account withdraws to the destination chain.

Because the shield and the release are both public, the all-in cost of Section 4 can be computed per quote. It contains every fee charged on the private side and the solver spread. It cannot separate them.

**Sample (post hoc).** The frame is the 334 quote accounts that send to the treasury in a random sample of 2,000 transactions of `intents.near` drawn from the windows. For each account we read all its transactions within 20,000 blocks on either side. The outcomes are 263 swaps, 6 releases of the same token, 3 with several releases, and 62 with no release in that span, which are excluded and may be refunds or slow fills. Of the 263 swaps, 194 are priced on both sides and 69 are not [measured].

**TABLE 3.** All-in user cost on the confidential route, value-weighted, stablecoins at $1 [measured, post hoc].

| Slice | Quotes | Volume in sample | All-in cost | 95 % CI | Median per quote |
| --- | --- | --- | --- | --- | --- |
| **All priced swaps** | 194 | $434k | **21.65 bps** | 10.54–51.07 | 54.9 bps |
| Same asset across chains (needs no price) | 55 | $180k | **3.56 bps** | 2.22–7.23 | 3.0 bps |
| Stablecoin to stablecoin | 64 | $247k | −1.25 bps | −5.19–2.43 | 2.0 bps |
| **Other pairs** | 130 | $188k | **51.78 bps** | 32.58–132.66 | 79.3 bps |
| Under $100 | 107 | $2.5k | 60.4 bps | 44.0–74.6 | 62.5 bps |
| $100–1k | 53 | $16.7k | 70.1 bps | 46.9–92.8 | 69.6 bps |
| $1k–10k | 25 | $84k | 73.7 bps | 37.3–109.0 | 46.1 bps |
| $10k–100k | 9 | $331k | 5.6 bps | −2.0–14.4 | 1.4 bps |

**Scale.** Scaled like the other sample estimates, the priced quotes are about $31.7M a day of input, and users pay about $69k a day all-in. That is about 15 times the user cost on the public route.

**Reading** [judgment].

- The headline is pulled down by a few large stablecoin and bitcoin quotes. The typical quote has a median size of $74 and pays about 55 bps.
- The same-asset figure needs no price. It is consistent with the documented 1 bp rate for such routes plus a few bps. The figure for other pairs is consistent with the documented 20 bps default plus app fees and spread [15]. The split itself is not measurable on chain.
- Stablecoin pairs carry about ±8 bps of pricing error, because every stablecoin is valued at $1.
- **Robustness.** Pricing one stablecoin at its market rate and adding nine more tokens prices 237 of the 263 swaps. The all-in cost becomes 26.09 bps (95 % CI 14.73–56.18), stablecoin pairs 2.23 bps (95 % CI 1.58–4.50), other pairs 54.77 bps (95 % CI 36.27–115.54), and the daily total about $86k. The conclusions do not change. Table 3 keeps the $1 convention so that it compares with Table 2.
- A concurrent study that requested quotes without executing them reports costs of the same order against a second exchange's mid [24] [secondary].

**Both routes agree on where the cost sits.** Users pay 32 bps on the public route and 22 bps value-weighted on the confidential route, or about 52 bps outside stablecoin and same-asset routes. On both, the bulk of the cost is in the fee layer, not in order-based extraction.

### 5.5 Flows across the ledger boundary: facts only

**On public swaps.** Of priced user volume on the public route, 96.7 % is from one foreign asset to another (97.6 % under a corrected asset rule, Appendix C). 1.2 % goes from NEAR-side assets to foreign assets ($16.3k a day; 0.8 % and $11.3k corrected), 1.6 % goes the other way, and 0.5 % stays NEAR-side. Users' net flow of wrapped NEAR is −77 NEAR a day, which is noise at this share. NEAR is the venue for these swaps, not their source [measured].

**At the ledger boundary.** In the random sample of 2,000 transactions, deposits into the ledger are about $163M a day (95 % CI $71–202M) and withdrawals about $73M a day (95 % CI $38–101M). The largest single transaction is 22.4 % of sampled deposits and 20.1 % of sampled withdrawals, so these flows are heavy-tailed. The largest deposit source is Ethereum at $114M a day; the largest withdrawal destinations are Tron at $24M and Solana at $12M (Appendix A.6) [measured, post hoc].

Deposits above withdrawals over one week cannot be read as a trend: the intervals are wide and some withdrawal legs are unpriced [judgment]. None of this says anything about users leaving or joining NEAR.

---

## 6. The value-accrual model

### 6.1 Model

For each stream that reaches NEAR holders we take its dollars a day and divide by NEAR's issuance in dollars a day:

> offset = stream / (supply × maximum inflation × NEAR price / 365).

Supply is 1.31 billion NEAR and maximum inflation is 2.5 %, from the live protocol configuration. The price is the study week's median, $3.60. Issuance is then about **$323k a day**, or about 89.8k NEAR a day. The streams are the Intents buyback, burnt gas, and on-chain arbitrage as an upper bound on what an order auction could capture. The inputs are DefiLlama's public daily series for NEAR Intents volume, fees and holders' revenue, and for NEAR gas fees and burn [16] [secondary], fetched on 2026-11-14, together with the measurements of Section 5. The model is post hoc.

### 6.2 What is measured on chain

**The wallets exist and are active** [measured, 2026-11-14]. `buybacks.multisignature.near` is a multisig that needs 2 of 4 keys. It holds about 2.29M NEAR and appears in 3,416 transactions, counting those in which it only receives, the latest at block 224,557,456. `fefundsadmin.sputnik-dao.near` holds about 2.02M NEAR. `1csfundsadmin.sputnik-dao.near` exists.

**NEAR accumulates in them** [measured]. Between blocks 220,090,000 and 224,566,803, a span of 30.26 days:

- the buyback wallet grew by 293,275 NEAR, which is 9,691 NEAR a day or 10.8 % of issuance;
- `fefundsadmin.sputnik-dao.near` grew by 115,550 NEAR, or 4.3 % of issuance;
- `1csfundsadmin.sputnik-dao.near` did not change.

Together that is about **13.5k NEAR a day, 15.0 % of issuance**. The figure is net of any outflows and uses no price and no label.

### 6.3 What "buyback" does and does not mean

DefiLlama counts as holders' revenue the NEAR and wrapped NEAR swept into the revenue wallets, and attributes it to Intents fees [16] [secondary]. Three observations limit how far that label can be taken.

- The two largest direct transfers into the buyback wallet in the study week are small: 453 NEAR on about 2026-11-13 and 531 NEAR on about 2026-11-10. The wallet has 27 direct transactions and about 3,400 receipts, and the most recent receipts we read are NEAR transfers from `intents.near`, one of them of 357 NEAR. The NEAR therefore appears to arrive mainly as withdrawals from the Intents ledger. We did not sum those receipts, and we did not trace where or at what price the NEAR was acquired inside the ledger [measured, explorer, read 2026-11-14].
- A concurrent analysis traced about 2,440 NEAR a day of purchases on chain, about 2.7 % of issuance. That is a lower bound, because transferred NEAR may have been bought elsewhere [21] [secondary].
- The NEAR revenue dashboard showed about 1.78M NEAR for the buyback wallet on 2026-11-14, against about 2.29M on chain [18].

The 18.6 % in Table 4 is therefore NEAR delivered into holder-aligned wallets as DefiLlama attributes it. It is not a reconciled record of purchases. The three figures bracket the stream: at least 2.7 % visible as purchases, 15.0 % accumulating on chain, and 18.6 % by attribution.

### 6.4 The model's output

**TABLE 4.** Intents fee layer against issuance, by window [secondary inputs; our arithmetic at $3.60].

| Window | Intents volume a day | Fee rate | Holders' share of fees | Buyback a day | Buyback, % of issuance | Gas burn, % of issuance | Volume multiple to offset issuance |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Study week (2026-11-07 to 2026-11-13) | $140.0M | 19.2 bps | 20.2 % | $54.3k | 16.8 % | 0.7 % | 5.9× |
| **Last 30 days** | **$126.6M** | **16.5 bps** | **28.8 %** | **$60.1k** | **18.6 %** | **0.9 %** | **5.3×** |
| Last 90 days | $137.6M | 15.8 bps | 26.8 % | $58.1k | 18.0 % | 0.9 % | 5.5× |
| Since the buyback began (2026-02-23) | $92.1M | 15.6 bps | 21.7 % | $31.1k | 9.6 % | 0.6 % | 10.4× |

- **Against the alternatives.** Over the last 30 days the buyback is about 20 times burnt gas and about 170 times on-chain arbitrage at baseline.
- **Holders' share of what users pay.** Holders receive 4.75 bps of volume. Users pay 21.65 bps on the confidential route and 32.16 bps on the public route, so holders receive about 22 % and about 15 % of the user's cost (18 % under the robustness pricing of Section 5.4).
- **Growth.** At the 30-day rates, buyback plus burn offset about 19.5 % of issuance at today's volume, about 38 % at twice the volume, about 57 % at three times and about 94 % at five times. They match issuance at about 5.3 times, or about $675M a day.
- **Price.** Issuance is fixed in NEAR and the buyback is fixed in dollars, so the offset moves inversely with the price: about 35 % at $2 and about 12 % at $6.
- **Issuance policy.** Governance approved HSP-029 on 2026-11-03. It lowers the issuance ceiling from 2.5 % to 1.6 % over 24 months, after a review and a grace period [19] [secondary]. It is not in force on 2026-11-14. At 1.6 %, every offset above rises by a factor of 2.5/1.6, about 1.56.

### 6.5 What an order auction would add

NEP-541, a proposal for a transaction priority fee, was closed on 2025-09-22 as retracted for author inactivity [12] [verified through an independent review of the record]. Its motivation was congestion and inclusion, not capturing extraction [secondary]. On our numbers, an auction that captured and burned all Rhea arbitrage would offset about 0.39 % of issuance. The trading cost users bear sits in the Intents fee layer, and it is set by integrators and 1Click, not by the protocol [judgment].

### 6.6 Reading [judgment]

Of the streams we measured, the only one from trading on NEAR that is large against issuance is the buyback funded by the Intents fee layer. It is roughly a fifth of issuance by attribution and 15.0 % by on-chain accumulation. Its share of fees in the last 30 days is above its average since it began. It would need about a fivefold increase in volume at current rates to offset dilution on its own.

---

## 7. Evidence against

This section lists what weighs against the thesis and what went against our own registered expectations.

1. **The public route is about 1 % of reported volume.** DefiLlama reports a mean of $140.0M a day for NEAR Intents over 2026-11-07 to 2026-11-13 [16] [secondary]. Our priced volume on the public route is $1.37M a day, 0.98 % of that. In the random sample of 2,000 transactions, 0.9 % carry a `token_diff`, 55.6 % are transfers without one, 20.1 % are deposits, 10.6 % are withdrawals and 12 % have no `intents.near` event. The cost stack of Table 2 describes users on the public route. It does not describe the Intents solver market. For the confidential route we have the all-in cost only; its division between fees and spread happens on `intents.far` and is not public.
2. **The value-accrual case rests on a policy and on secondary data.** The holders' share is set by the ecosystem, not by the protocol, and can be cut. It averaged 21.7 % of fees since the buyback began, against 28.8 % in the last 30 days. Volume, fees and holders' revenue are DefiLlama's series, built on datasets uploaded by NEAR that we cannot audit, and we did not reconcile them with the wallets' inflows. Since it began, the buyback has offset only about 9.6 % of issuance on average.
3. **Visible purchases are much smaller than the label.** Purchases traceable on chain are about 2.7 % of issuance [21], against 18.6 % by attribution. The on-chain accumulation of 15.0 % shows the NEAR arrives; it does not show where or at what price it was bought.
4. **Solver spread cannot be told apart from zero.** Its interval is −$102 to $2,529 a day, and one swap is 61 % of it. The registered hypothesis that the auction moved into Intents cannot be tested on this slice, and we withdraw it as a claim.
5. **A registered kill criterion on scale was triggered.** One hundred times today's Rhea arbitrage would be 38.6 % of maximum issuance, far above the registered 1 % threshold. Arbitrage would need to grow only about 2.6 times to reach 1 % of issuance. The data do not support a claim that order auctions are irrelevant forever.
6. **A registered kill criterion on cost was triggered.** On the registered definition, Intents users pay 8.09 bps against mid (32 bps with app fees). That is more than Rhea's arbitrage take of 1.54 bps. Swapping through Intents is not cheaper than the pools' arbitrage bleed by this measure. The two quantities are also not like for like: a loss to liquidity providers is not a user fee [judgment].
7. **Concentration passed its threshold only narrowly** on the registered cut: 50.2 % against 50 %. It is robust outside the spike (61.6 %).
8. **Informed flow may exceed on-chain arbitrage.** Directional swaps between wrapped NEAR and stablecoins lose, as a whole, $940 a day against the Binance price 60 s later and $515 a day at 300 s. An informed subset exists: 28 of 46 accounts with at least 10 swaps are net positive at 300 s, and in a split-half test the first-half winners earn about $1,000 a day in the second half [measured, rough]. A reading of "extraction is $350 a day" understates the value that informed traders take from liquidity providers without needing order.
9. **The validator test is a null result with a borderline cell.** The first test gives p = 0.08, and 3.6 % of lookups are missing. The test detects clustering, not intent.

---

## 8. Risks and what would change our mind

### 8.1 Risks to the thesis [judgment]

- **Policy risk.** The buyback can be reduced, redirected or ended by the parties that control the revenue wallets. The buyback wallet is controlled by 2 of 4 keys, and nothing we opened names the signers publicly [verified on chain; judgment].
- **Opacity risk.** Most volume settles on a confidential ledger. Holders cannot verify from the public chain who receives the fees or how purchases are executed.
- **Distribution risk.** Integrators, 1Click and solvers keep 78–85 % of what users pay. Integrators own the user relationship and could route elsewhere.
- **Data risk.** The headline volume and fee series come from one aggregator reading datasets that NEAR uploads.
- **Price and issuance.** The offset moves inversely with the NEAR price and rises if the lower issuance ceiling takes effect. Neither is under the fee layer's control.
- **Operational risk.** NEAR Intents halted services after an exploit reported on 2026-10-01, and the team pledged full compensation [22] [secondary]. A fee layer that carries the value-accrual case also concentrates this kind of risk.
- **Sample risk.** All measurements are from one week.

### 8.2 What would change our mind

- **A cut in the holders' share, or a sustained fall in Intents volume or fee rate.** If the product of the three falls well below today's level of about 19 % of issuance for months, or the buyback ends, the case weakens to "NEAR is a cheap venue whose value accrues to others."
- **A reconciliation of DefiLlama's holders' revenue with the wallets' inflows.** A large gap would change the size of the stream. It would not change its ranking against gas burn or arbitrage unless the gap exceeded about 95 %.
- **A fee and spread split for the confidential route.** Our all-in figure cannot say who receives it. If 1Click's own share or a NEAR treasury share were large, the reading "value goes to the distribution layer" would need to name 1Click instead of integrators.
- **An identification of the fee recipients.** `5880ad2b…` is probably 1Click's own fee recipient: public integration code appends it to the app fees as 1Click's own fee [secondary; the documentation does not name the account]. If `143f2bb4…` or `c4d748df…` proved to be a NEAR treasury, the "about zero to the protocol" part of the claim would weaken.
- **Producer clustering in a replication.** A result of p < 0.01 within shard and window would overturn "no evidence of paid ordering."
- **More windows like the spike.** If router-driven events recur weekly or more often, the all-window mean of about $1.2k a day is the right planning number, not the baseline of about $350.
- **A confirmed sandwich across pools or routes.** We searched the same-pool shape only.

---

## 9. What to watch

A holder who accepts this thesis can track it with a short list of public observations [judgment].

| Indicator | Where it is visible | Reading |
| --- | --- | --- |
| Intents volume a day | Aggregator series | The first factor of the product. Break-even is about 5.3 times the 30-day level at current rates |
| Fee rate, bps of volume | Aggregator series | 16.5 bps over the last 30 days |
| Holders' share of fees | Aggregator series | 28.8 % over the last 30 days; 21.7 % since the buyback began |
| NEAR accumulating in the revenue wallets | On chain, per wallet | 13.5k NEAR a day over the 30 days measured. This is the check that needs no label |
| Purchases visible on chain | On chain | A lower bound of about 2.7 % of issuance today |
| Issuance ceiling | Governance and protocol configuration | 2.5 % in force; 1.6 % approved, not in force |
| Share of activity on the confidential route | On chain, treasury transfers | 46 % of `intents.near` transactions in the study week |

---

## 10. Method and reproducibility

### 10.1 Sampling and scaling

The 168 windows are evenly spaced across the range, which makes the sample systematic and not random. For a quantity measured on the sampled transactions of a contract, the per-day estimate is the sample sum, multiplied by the ratio of the contract's full-range transaction count to its sampled count, divided by the length of the range in days. Ratios such as cost per unit of volume are formed from two such sums, so the scale factor cancels. The ledger-boundary and confidential-route estimates use a random sample of 2,000 transactions of `intents.near` drawn from the windows, in which one sampled transaction stands for about 73 transactions a day.

### 10.2 Pricing

- **Rhea.** Wrapped NEAR is valued at the Binance one-minute close, stablecoins by contract, and other tokens at their median execution rate.
- **Intents.** Stablecoins are matched by symbol and valued at $1 on every chain. NEAR, BTC, ETH and SOL are priced as registered, and ZEC, TRX, BNB and TON were added afterwards; both versions are reported (Appendix B). Tokens of one bridge provider have no price and are excluded.
- **Confidential route.** Both legs are valued at the price of the release transaction. On same-asset routes the cost reduces to (amount in − amount out) / amount in and needs no price.

### 10.3 Estimators

- **Arbitrage.** Swap hops are parsed from the logs of every receipt in the windows. A cyclic arbitrage is found per transaction, and its profit is the value of the net token change.
- **Public route.** For every sampled transaction with a `token_diff` intent we read the ledger's events. An account counts as a solver when it has at least 20 `token_diff` entries (the registered rule); Appendix A.4 shows the result under other rules.
- **Confidential route.** The treasury account is identified from the documentation [14]. For each sampled quote account we recover the deposit, the shield, the release and the withdrawal.
- **Validators.** The producers of the chunks that included winning back-runs are compared with each shard's producer mix at random heights in the same windows (a Monte Carlo χ² test with 2,000 draws) and with failed attempts by the same bots (a label permutation with 2,000 permutations, within shard and within shard and window).
- **Wallet accumulation.** Balances of the three revenue wallets are read at two block heights from archival nodes, and the difference is divided by the elapsed days.

### 10.4 Reproducibility

The measured numbers computed from the sampled data, and the model's outputs, are recomputed offline from stored and hashed copies of that data, by a check that returns pass or fail per number. The check runs without network access. Facts read live from a node or an explorer are not covered by it: the protocol configuration, the chunk headers, and the wallets' balances, counts and transfers. The algebra the claims rely on (the price-free same-asset cost, the cancellation of scale in ratios, and bounds on a weighted mean) and the arithmetic of derived figures are machine-checked in the Lean 4 proof assistant.

All data are public and were read through read-only public interfaces: the FastNEAR explorer interface and archival nodes, NEAR RPC nodes, Binance public price history, and the DefiLlama public API.

### 10.5 Pre-registration and its timestamp

The hypotheses and kill criteria were registered in three stages on 2026-11-14: the Rhea part at about 10:50 UTC, the Intents part at about 14:40 and the flows part at about 15:35. These times are the authors' own notes. The SHA-256 of the registration document is `751ca84ec592f49058ae6c2499e0a8b18200276bcfc7ddd3014f69c719ae3fe8`, taken at 16:17:43 UTC. That hash proves only that the document has not changed since. The same hash was submitted to four OpenTimestamps calendars at 18:06:28 UTC and is anchored in Bitcoin block 975,830. The public timestamp proves that the document existed no later than 18:06 UTC, not at 16:17. We have no independent proof of when each stage was written.

The methods for fee attribution and solver sensitivity build on an independent blind adversarial review of 2026-11-14.

---

## 11. Limits

1. **One week, heavy tails.** The sample is 168 systematic windows of one week. The bootstrap treats windows as exchangeable. One window holds 72.2 % of arbitrage profit. The interval of the baseline is rescaled by 168/167 while its point estimate is not, a difference of 0.6 %.
2. **Pricing.** Stablecoins are matched by symbol and valued at $1. Four price pairs were added after registration. Unpriced tokens are excluded from both Intents measures: 534 swaps on the public route and 69 on the confidential route. Rhea's priced volume is a lower bound.
3. **App-fee attribution is post hoc.** Treating a transfer to a non-counterparty under the user's own intent as a fee is a judgment. All 496 transfers are fee-sized except 16 dust transfers, and none goes to a counterparty of the same swap.
4. **The treasury's flows are bridge flow, not trades.** The account has no contract and a balance of 0.01 NEAR; its first activity was on 2026-02-18, and it appears in 47 % of sampled transactions. It receives about $60M a day from named solver accounts and about $49M a day from hexadecimal-named accounts, and sends about $62M a day to 586 such accounts and about $26M a day to solvers. The $88M a day it sends (95 % CI $50–111M; the largest transaction is 19.6 % of the sampled sum) consists of shields and releases, and counting it as swap volume would double-count. Releases to solvers in the same transaction as a user's release are the solvers' own, and we do not read the difference as a fee. The documentation names the account's role [14] but not its legal operator.
5. **The aggregator's method cannot be audited.** DefiLlama's volume adapter sums one pre-aggregated column from a dataset that NEAR uploads [17] [secondary]. It contains no event logic, so whether shields, releases or both legs are counted is decided inside a dataset we could not open [to verify]. The 1 % coverage figure is approximate for that reason.
6. **The validator test** leaves out 170 of 4,755 chunk lookups (3.6 %), and its first test is borderline at p = 0.08. An earlier run on the last 23 windows only, with 142 winners, gave p = 0.50 and p = 0.23.
7. **Execution order within a block** comes from the explorer interface's outcome index per pool. One example was checked against a second data source in the original analysis; that check was not repeated here.
8. **Grouping of accounts** into the `<name>1.near` family is by name only, without analysis of funding.
9. **Data provenance.** Token metadata and price history were fetched on 2026-11-14 at 16:03 UTC for Intents and 16:22 UTC for Rhea. Re-collecting online can shift results slightly if metadata changes. Rhea's priced volume reproduces the original analysis within +0.2 %, because metadata was refetched (247 unpriced tokens against 290).
10. **The value-accrual model.** The model adds the buyback to burnt gas, although NEAR in the revenue wallets is held and can be spent, while burnt gas leaves supply. Issuance is priced at one week's median price and uses the maximum inflation rate. DefiLlama's series are secondary. Gas burn before 2026-11-04 is DefiLlama's estimate of 70 % of gas fees. Holders' revenue is an attribution, purchases visible on chain are a lower bound, and we did not reconcile the two.
11. **The confidential-route sample.** 62 of 334 sampled quote accounts (19 %) show no release within the search span and are excluded. If they are refunds or slow fills, their cost is not represented. The span of 20,000 blocks on either side is a design choice and was not registered.
12. **Markouts.** Horizons below 60 s cannot be measured from one-minute prices.
13. **Timestamp.** The independent timestamp of the pre-registration is 18:06 UTC, about two hours after the hash was taken (Section 10.5), and the first hypotheses were written after a pilot (Appendix C).

---

## 12. Conclusion

On a chain that does not sell transaction order, one week of evidence supports five statements.

1. Order-based extraction on the on-chain exchange is small next to what users pay to trade, and a few bots that compete by speed take most of it.
2. Validators receive no share of fees by protocol rule, and we detect no preference of block producers for the winning transactions.
3. On the public route of NEAR Intents, the largest cost to users is the app fee carried in their own signed intent, not solver spread or protocol fee.
4. On the confidential route, which carries far more of the system's activity, users pay a fee layer of similar order that the public chain cannot attribute.
5. For a long-term holder, the NEAR accumulating from the Intents fee layer is the only trading stream we measured that is large against issuance, and it is held in wallets, not burned.

The investment case for NEAR from trading therefore rests on Intents volume, its fee rate and the holders' share. Selling order would capture little today. The same evidence marks the case's weak points: the holders' share is a policy, most settlement is confidential, the label on the buyback exceeds what can be traced as purchases, and everything here comes from one week. Further work should obtain the fee split on the confidential ledger, reconcile the aggregator's holders' revenue with the wallets' inflows, extend the sandwich search to routes across pools, and repeat the week to test whether router-driven events recur.

---

## References

[1] P. Daian, S. Goldfeder, T. Kell, Y. Li, X. Zhao, I. Bentov, L. Breidenbach and A. Juels, "Flash Boys 2.0: Frontrunning in decentralized exchanges, miner extractable value, and consensus instability," in Proc. IEEE Symp. Security and Privacy, 2020. https://arxiv.org/abs/1904.05234

[2] K. Qin, L. Zhou and A. Gervais, "Quantifying blockchain extractable value: How dark is the forest?" arXiv:2101.05511, 2021. https://arxiv.org/abs/2101.05511

[3] L. Zhou, K. Qin, C. Ferreira Torres, D. V. Le and A. Gervais, "High-frequency trading on decentralized on-chain exchanges," arXiv:2009.14021, 2020. https://arxiv.org/abs/2009.14021

[4] J. Milionis, C. C. Moallemi, T. Roughgarden and A. L. Zhang, "Automated market making and loss-versus-rebalancing," arXiv:2208.06046, 2022. https://arxiv.org/abs/2208.06046

[5] L. Heimbach, V. Pahari and E. Schertenleib, "Non-atomic arbitrage in decentralized finance," in Proc. IEEE Symp. Security and Privacy, 2024. https://arxiv.org/abs/2401.01622

[6] T. Chitra, K. Kulkarni, M. Pai and T. Diamandis, "An analysis of intent-based markets," arXiv:2403.02525, 2024. https://arxiv.org/abs/2403.02525

[7] B. Bachu, X. Wan and C. C. Moallemi, "Quantifying price improvement in order flow auctions," arXiv:2405.00537, 2024. https://arxiv.org/abs/2405.00537

[8] Y. Yuminaga, D. Chen and D. Sui, "Execution welfare across solver-based DEXes," arXiv:2503.00738, 2025. https://arxiv.org/abs/2503.00738

[9] R. Zhang, "Incentives and market structure in intent-based exchanges: Evidence from a solver-reward reform," in Proc. Int. Workshop Cryptocurrencies and Blockchain Technology (CBT), 2026. https://arxiv.org/abs/2607.21955

[10] T. Roughgarden, "Transaction fee mechanism design for the Ethereum blockchain: An economic analysis of EIP-1559," arXiv:2012.00854, 2020. https://arxiv.org/abs/2012.00854

[11] NEAR documentation, "Gas," accessed 2026-11-14. https://docs.near.org/protocol/gas

[12] NEAR Protocol, "NEP-541: Transaction priority fee," GitHub pull request, closed 2025-09-22. https://github.com/near/NEPs/pull/541

[13] A. Astafiev, "HSP-027: Remove the NEAR developer gas rebate," NEAR governance forum, 2026-06-15. https://gov.near.org/t/hsp-027-remove-the-near-developer-gas-rebate/42213

[14] NEAR Intents documentation, "Confidential liquidity" and "Confidential intents," accessed 2026-11-14. https://docs.near-intents.org/integration/market-makers/confidential-liquidity

[15] NEAR Intents documentation, "Fees" and "1Click fee configuration," accessed 2026-11-14. https://docs.near-intents.org/resources/fees

[16] DefiLlama, public API daily series for NEAR Intents volume, fees and holders' revenue and for NEAR gas fees and burn, fetched 2026-11-14. https://api.llama.fi/summary/fees/near-intents

[17] DefiLlama, NEAR Intents volume adapter, GitHub repository, accessed 2026-11-14. https://github.com/DefiLlama/dimension-adapters/blob/master/dexs/near-intents/index.ts

[18] NEAR, revenue dashboard, accessed 2026-11-14. https://revenue.near.org

[19] D. Park, "NEAR governance approves proposal to cut token issuance ceiling to 1.6%," The Block, 2026-11-03. https://theblock.co/news/defi/2026-11-03-near-governance-approves-proposal-to-cut-token-issuance-432378

[20] AloysJehwin (GitHub user), "Capture without churn," GitHub repository, 2026. https://github.com/AloysJehwin/near-capture-without-churn

[21] Damianonyx (GitHub user), "NEARparity," GitHub repository, 2026. https://github.com/Damianonyx/NEARparity

[22] K. Baird, "NEAR Intents halts services after $3.8 million exploit, promises full compensation," The Block, 2026-10-01. https://theblock.co/news/ecosystems/2026-10-01-near-intents-halts-services-after-3-8-million-exploit-promises-full-compensation-417404

[23] Eren-dotcom (GitHub user), "near-intents-xray," GitHub repository, 2026. https://github.com/Eren-dotcom/near-intents-xray

[24] Utkarsh1446 (GitHub user), "intents-thesis-near," GitHub repository, 2026. https://github.com/Utkarsh1446/intents-thesis-near

---

## Appendix A. Detailed results

All figures in this appendix are [measured]. Those marked post hoc were not registered.

### A.1 Anatomy of the spike window (post hoc)

The window starts at block 224,412,917 on 2026-11-13 at about 20:20 UTC.

- **Trigger.** The contract `pool.near-meme-router.near`, signed by `euwest1-fwd.near-meme-router.near` and `home-fwd.near-meme-router.near`, sent 156 router transactions in the window, of which 5 failed. Its first clip, of $10,000 (transaction `CsRY5e4F…`, block 224,412,934), failed. Later clips succeeded; the largest were $2,374, $2,240, $1,333 and $1,000.
- **Response.** 138 arbitrages ran from block 224,412,985 to 224,413,513, mostly three-hop cycles from wrapped NEAR through USDC and PEARL back to wrapped NEAR. One example is transaction `ZNRqvoRq…` by `walrus1.near`, with a profit of $36.31. Back-runs earned 38.7 % of the window's profit.
- **Split.** `xoperfan.near` took 43.8 %, `heron1.near` 12.6 %, `0wl1.near` 8.9 % and `walrus1.near` 8.5 %.

### A.2 Operator concentration (post hoc cuts)

| Cut | Top-three share | Notes |
| --- | --- | --- |
| By sender, all windows | 50.2 % (HHI 1,411; 44 senders) | `xoperfan.near` 31.6 %, `notest.near` 9.3 %, `whatdoyoumean.near` 9.3 % |
| By sender, excluding the spike | 61.6 % (HHI 1,726) | `whatdoyoumean.near` 32.3 %, `notest.near` 19.8 %, `derek1.near` 9.5 % |
| By signer | 50.2 % | Same as by sender: no relayer hides operators |
| `<name>1.near` family (16 accounts) | 38.2 % all; 20.2 % excluding the spike | Grouped by name only [judgment] |

In the sandwich search, 223 of the 467 patterns are two market makers, `vx-zec.near` and `closemeat6237.near`, interleaving. The rejected candidate's "victim" is `zoe1.near`.

### A.3 Public route by trade size and by integrator (post hoc)

| Size | Swaps | Volume $/day | App fee bps | Solver bps | Total bps |
| --- | --- | --- | --- | --- | --- |
| Under $100 | 264 | $6.5k | 107.9 | 8.7 | 117.1 |
| $100–1k | 94 | $49k | 43.5 | 7.1 | 50.7 |
| $1k–10k | 35 | $176k | 37.6 | 1.9 | 39.5 |
| $10k–100k | 11 | $461k | 42.6 | 5.6 | 48.2 |
| $100k and above | 2 | $680k | 5.8 | 11.4 | 17.3 |

Groups by referral tag with at least 10 swaps:

| Integrator tag | Swaps | App fee bps | Solver bps | Total bps |
| --- | --- | --- | --- | --- |
| 1click:swapkit | 102 | 111.1 | 6.3 | 117.4 |
| 1click:unknown | 111 | 43.3 | 21.6 | 64.9 |
| 1click:lifi | 26 | 6.7 | 14.1 | 20.9 |
| 1click:rango | 25 | 1.8 | −0.4 | 1.4 |
| 1click:aurora (all widgets) | 26 | 11.3 | 11.9 | 23.3 |
| 1click:zodl | 11 | 38.7 | −1.5 | 37.2 |
| (no referral) | 51 | 0 | −18.9 | −18.8 |

Fee recipients: `c4d748df…` has 13 transfers, all under the swapkit tag, at a median of 140 bps and $1,818 a day. `5880ad2b…` has 124 transfers across six tags at a median of 1.0 bps and $415 a day. `143f2bb4…` has 70 transfers across six integrators at a median of 1.4 bps.

### A.4 Sensitivity of the public-route stack to the solver rule (post hoc)

| Solver rule | Solver $/day | Solver bps | App fee bps | Total bps |
| --- | --- | --- | --- | --- |
| At least 5 entries | 1,352 | 10.69 | 26.53 | 37.25 |
| At least 10 | 1,336 | 10.61 | 26.31 | 36.94 |
| **At least 20 (registered)** | **1,108** | **8.07** | **24.07** | **32.16** |
| At least 50, or at least 100 | 1,279 | 9.13 | 23.42 | 32.58 |
| Curated by name | 1,356 | 10.68 | 26.44 | 37.16 |
| Top "solver" `6247d9…` treated as a user | −246 | −1.62 | 18.16 | 16.56 |

- The top solver account, `6247d9…`, takes 75 % of solver capture. Reclassifying it as a user turns capture to −$246 a day.
- The largest swap, `FQcNTHHq…`, moved $242,799 from USDT to USDC through one integrator. The solver earned $455.61 on it (18.8 bps), and it carried an app fee of $243.04.
- The 16 transfers above the 200 bps cap total $68.63 in the sample.
- The review's alternative rule, which excludes any receiver in the global solver set, gives 23.34 bps. That rule misses `2f09a4dc…`, a fee recipient with exactly 20 `token_diff` entries that the registered rule counts as a solver: 61 transfers at a median of 81 bps.
- The top three solvers take 99.4 % of solver capture on this route (14 solver accounts in all).

### A.5 Confidential route: example and details (post hoc)

- The four steps of Section 5.4 can be followed on the quote account `e464353c…`.
- Of the 263 swaps, 246 show the withdrawal to the destination chain within the search span.
- In the release transaction the treasury also releases tokens to solvers.
- The 69 unpriced swaps involve XRP, LTC, SUI and tokens of one bridge provider.
- A swap from USDC to USDT appears to gain users about 8 bps under the $1 convention, which is the source of the negative stablecoin row in Table 3.
- The robustness pricing values USDC at its Binance rate against USDT and adds XRP, LTC, POL, SUI, PEPE, SHIB, BCH, PENGU and DOGE.

### A.6 Ledger boundary by chain (post hoc)

| Direction | Largest by priced value, $/day |
| --- | --- |
| Deposit sources | Ethereum $114M, Tron $24M, BTC $12.5M |
| Withdrawal destinations | Tron $24M, Solana $12M, Ethereum $11M, NEAR-native tokens $11M, BTC $7.7M |

Legs in tokens of one bridge provider and in XRP, LTC and DOGE are unpriced.

### A.7 A concurrent fee estimate

A concurrent analysis reports the fee users paid per $100 swapped as 17.7 cents before and 17.8 cents after the fee switch of 2026-02-23, from DefiLlama's daily volume and fees [20] [secondary]. That is a fee-only, volume-weighted rate over all reported volume. Our all-in figures of 22 bps and 32 bps also include spread against mid. The methods differ, so the agreement in order of magnitude is the point, not the exact figure [judgment].

---

## Appendix B. Pre-registration outcomes

Each kill criterion (KC) is listed with its registered rule and its result. All outcomes are recomputed by the offline check.

| KC | Rule | Result | Hypothesis |
| --- | --- | --- | --- |
| KC1 | Fewer than 30 cyclic arbitrages: no estimate | 1,652. Not triggered | n/a |
| KC2 | Under $100/day: "negligible" | $1,247 ($347 excluding the spike). Not triggered | n/a |
| KC3 | At least 1 confirmed sandwich | 1 strict candidate, rejected on post-hoc review; 0 confirmed | **H2 survives**, for the same-pool shape only |
| KC4 | Top-three share under 50 % | 50.2 %. Not triggered | **H1 survives**, narrowly |
| KC5 | 100× arbitrage at or above 1 % of issuance | 38.6 %. **Triggered** | **H3 killed** |
| n/a | H4: validators receive 0 % | No fee share by mechanism; no producer clustering (Section 5.2). Its registered wording said 30 % of gas goes to the called contract, which was **wrong**: the live value is 0 | Survives in corrected form |
| KC6 | Solver capture under $350/day | $1,108 point estimate; **interval includes 0**; $427 without the top swap | **H5 survives on the point estimate only and is withdrawn as a claim**: the slice is 1 % of the venue |
| KC7 | Top-three solvers under 60 % | 99.4 %. Not triggered | **H6 survives** |
| KC8 | Protocol fees at or above solver capture | $3.72 against $1,108. Not triggered | **H7 survives as registered**, for the protocol fee only. **In substance it is false**: integrator fees (24 bps) are about three times solver spread. The test was framed too narrowly |
| KC9 | Fewer than 200 priced swaps | 406. Not triggered | n/a |
| KC10 | Net NEAR flow at or above 0 | −77 NEAR/day. Not triggered | H8 survives, but it is noise (NEAR-side share 0.5 %) and is not used in the argument |
| KC11 | Outward share at or above 50 % | 1.2 % (0.8 % with the corrected asset rule). Not triggered | **H9 survives** |
| KC12 | Intents user cost at or above 1.54 bps | 8.09 bps (32.16 with app fees). **Triggered** | **H10 killed** |

Under the pricing exactly as registered (stablecoins plus NEAR, BTC, ETH and SOL only), every outcome is unchanged. Solver capture is then $1,101 a day at 9.3 bps over 328 swaps, and app fees are 25.6 bps.

---

## Appendix C. Departures from the pre-registration

1. **Pilot before the first stage.** Before the first hypotheses were written, a 2.3-hour test sample and a sandwich count over 300 blocks had been run, together with an earlier blind review of a predecessor idea. The pilot suggested that the gas of failed attempts roughly equalled arbitrage profit. Over the week it is 6.4 %. H1 to H4 were therefore written after a pilot, not before any analysis.
2. **Extra price pairs.** The Intents analysis prices ZEC, TRX, BNB and TON. The registration named NEAR, BTC, ETH and SOL only. Both versions are reported and no outcome changes.
3. **Stablecoins by symbol.** Stablecoins are matched by symbol, not by contract as registered. Every matched token was listed by the blind review, and no counterfeit stablecoin was found. The token `hood.omft.near`, whose symbol is ETH, is priced as ETH.
4. **Foreign-asset rule.** The registered rule omits the bridged tokens under `*.omdep.near`. We report both versions, the correction marked post hoc. Registered: outward 1.2 %, NEAR-side 0.5 %. Corrected: outward 0.8 %, NEAR-side 0.3 %. KC11 is unchanged.
5. **Post-hoc analyses.** None of the following was registered. On Rhea: the baseline excluding the spike, the concentration cuts, the anatomy of the spike, the 300 s markouts and the split-half test. On Intents: app fees and the full stack, the breakdowns by size and by integrator, and the sensitivity to the solver rule. Also the ledger-boundary sample, the all-in cost on the confidential route, the validator test and the value-accrual model.
6. **Median price for issuance.** The median NEAR price is taken over the sample span only. An earlier version depended on when the data were fetched. The effect on arbitrage as a share of issuance is 0.3858 % to 0.3856 %.
7. **Timestamp.** See Section 10.5.

---

## Disclaimer

This paper is research. It is not investment advice and not an offer or recommendation to buy or sell any asset. It reflects the authors' reading of one week of public data and of the sources cited, and the authors may be wrong. Readers should check the evidence against the public record before relying on it.
