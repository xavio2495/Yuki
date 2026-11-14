# Analysis of the NEAR Chain from Arbitrage, Solver Spread and Distribution Fees: Value Accrual Through the Intent Fee Layer

Immanuel and Charles, independent researchers

## Abstract

NEAR does not sell transaction order: it has no priority fee, burns its transaction fees and pays validators from issuance. For a long-term holder the question is therefore where the value of trading goes, and whether any of it returns to the token. Measuring one week of mainnet activity and setting each stream that reaches holders against issuance, we find that, of the streams we measured, only one is large against issuance. The share of intent-system fees swept into NEAR buyback and revenue wallets accumulates on chain, where it is held, not burned. Order-based extraction and burnt gas are one to two orders of magnitude smaller, and validators receive no share of fees. Users pay mainly for distribution: application and routing fees on public intent swaps, and a fee layer of similar size on the confidential route that the public chain cannot split. Holders keep a minority of what users pay, and matching issuance in size would take a severalfold rise in intent volume at today's rates. The buyback is a policy rather than a protocol rule, which is the main risk to the thesis. Results computed from the sampled data are recomputed offline from public data.

**Index Terms:** blockchain, maximal extractable value, decentralized exchange, intent-based trading, transaction ordering, transaction fees, market microstructure.

## I. Introduction

On a public ledger, whoever orders transactions can profit from that order. On chains with priority fees or block-building markets, part of that profit is paid upward to the producer of the block, and studies of extractable value can follow the payments. The measurement question there is how large the payments are and who receives them.

Some chains do not sell order. A chain can process transactions without a priority field, without tips and without an auction for block space. Its validators can still choose and order transactions, but there is no protocol channel through which a searcher pays for position. Value from trading does not disappear on such a chain. Arbitrage still closes price gaps between pools, informed traders still trade against stale quotes, and users still pay for routing. The question is where that value goes once the auction is removed.

The answer matters for policy as well as for holders. A proposal to add a priority fee to such a chain is, implicitly, a bet that order-based value is large enough to be worth selling. A holder deciding whether fees or issuance carry the chain's economics needs to know whether trading value reaches validators or the protocol at all. A third reason is newer. Much trading has moved from on-chain pools to intent systems, in which users sign what they want and professional solvers fill it. In those systems the cost to the user can sit in fees charged by the applications that route the order, rather than in the price impact of a swap. Part of the settlement may also move to ledgers that public indexers cannot read.

The field therefore lacks an end-to-end account for a chain that does not sell order: one that follows trading value from the pool to the intent ledger and asks, layer by layer, who receives it.

## II. Related Work

**Ordering markets and extractable value.** Value extracted by ordering transactions was first measured on a chain where order is sold: bots bid transaction fees against each other for position, and the payment goes to block producers [@daian2020]. Later work quantified the scale of such extraction across arbitrage, liquidations and sandwich attacks [@qin2021] and formalized the sandwich attack on automated market makers [@zhou2020]. These studies observe extraction through the payment for order. A chain without an order market leaves no such payment to observe, and has not been measured in the same way.

**Arbitrage and the cost of liquidity.** Arbitrage against an automated market maker can be valued against an external price, which separates what liquidity providers lose to arbitrageurs from their market exposure [@milionis2022]. Arbitrage that spans a decentralized exchange and venues off the chain accounts for a large share of volume on the main exchanges of one chain [@heimbach2024]. Both use the external price as the yardstick we adopt. Neither rebuilds swaps from execution receipts on a sharded chain, where contract-triggered and multi-hop swaps are easy to miss.

**Intent and solver markets.** In intent-based exchanges, solvers compete to fill signed user orders. Entry costs can make a small set of solvers the welfare-preferred outcome [@chitra2024]. Auction-based interfaces improve prices for users by a few basis points [@bachu2024], execution quality differs across solver platforms and pairs [@yuminaga2025], and changing how solvers are paid shifts market concentration [@zhang2026]. These studies measure solver competition and price improvement on public settlement. They do not separate what the user pays to the applications that route the order, nor measure settlement that leaves the public ledger.

**Fee burning and value accrual.** Burning a protocol fee is analyzed as a mechanism-design choice [@roughgarden2020]. For this chain, a closed proposal to add a transaction priority fee [@nep541] shows that selling order has been considered and not adopted, and the intent system's documentation describes its fee schedule and a confidential settlement ledger [@confidential; @fees]. Concurrent studies report the fee rate users paid on the intent system from an aggregator's series [@twin] and trace the buyback's on-chain purchases [@nearparity]. Governance has approved a lower issuance ceiling that is not yet in force [@hsp029]. What is missing is a single account that values each layer of trading against an external price and sets what reaches token holders against issuance, with every step re-runnable.

## III. Problem and Objective

**Setting.** Two venues carry trading value on the chain, and a validator set orders their transactions. The first venue is an on-chain automated market maker whose pools are visible swap by swap. The second is an intent ledger on which a user's signed request settles either publicly, by a balance-difference intent matched against solvers in the same transaction, or confidentially. In the confidential route the user's funds move into a bridge treasury, the trade settles on a permissioned ledger that public indexers cannot read, and the output is released back to the user. The validators produce the blocks that order both venues and are paid from issuance. Most intent-ledger orders arrive through a routing service, 1Click, which wallets and other applications (integrators) call on the user's behalf. An integrator may add its own charge, an app fee, to the user's order. Part of the fees the intent system collects is swept into wallets aligned with NEAR holders and used to buy NEAR, the buyback; the aggregator we use reports it as holders' revenue.

**Objective.** For one week of mainnet activity we estimate, per day and as a share of traded volume:
1. The value taken by on-chain arbitrage and back-running, and its concentration across operators.
2. Whether that value reaches validators, either through fees or through a detectable preference of particular block producers for the winning transactions.
3. What users pay on the intent ledger, split into integrator fees, solver spread and protocol fee where settlement is public, and in total where it is confidential.

**Contributions.**
- A receipt-level reconstruction of swaps on a sharded chain that includes swaps triggered by contracts and multi-hop routes, used to value arbitrage against an external price.
- A decomposition of what intent-ledger users pay, attributing fees to the transfers signed under the user's own intent.
- A method that measures the all-in cost of confidential intent settlement from the public legs alone, with a price-free check on same-asset routes.
- A week-long estimate that places each layer of value side by side, with registered hypotheses and kill criteria for the arbitrage and solver measures and the later analyses marked as such.
- A value-accrual model, re-run from public data, that sets each stream reaching NEAR holders against the chain's issuance.

## IV. Method

**Sampling.** The week is covered by a systematic sample of $n = 168$ evenly spaced windows of 600 consecutive blocks. For a quantity $y_i$ measured on sampled transaction $i$ in the set $S$, the per-day estimate is

$$\hat{Y} = \frac{1}{D}\,\frac{N}{n_S}\sum_{i \in S} y_i, \tag{1}$$ <<E:sampling>>

where $N$ is the number of transactions of the relevant contract in the full range, $n_S$ the number sampled and $D$ the length of the range in days. Ratios such as cost per unit of volume are formed from two sums of the form (1). The factor $N/(D\,n_S)$ cancels, so a ratio does not depend on the scaling.

**Pricing.** Every token amount $a_k$ of token $k$ is valued at the external one-minute closing price $p_k(t)$ at the time $t$ of its transaction, with dollar stablecoins at par unless stated. The value of a bundle is $v(\mathbf{a}, t) = \sum_k a_k\, p_k(t)$.

**Arbitrage.** A transaction is a cyclic arbitrage when its swaps start and end in the same token. Its gross profit is the value of its net token change,

$$\pi = v(\Delta\mathbf{a}, t), \tag{2}$$ <<E:arbitrage>>

and a back-run is a cyclic arbitrage that is the next swap on a pool within one block after a non-arbitrage swap. A sandwich candidate is a pattern of attacker, victim and attacker swaps on the same pool, in execution order, within two blocks.

**Cost to users on public settlement.** For a matched trade with user volume $V$ at mid, the user's cost is the sum of three layers,

$$C = F_{\mathrm{app}} + S + F_{\mathrm{proto}}, \tag{3}$$ <<E:stack>>

where $F_{\mathrm{app}}$ is the value of transfers signed under the user's own intent to accounts that are not counterparties of the trade, $S$ is the solvers' net balance change valued at mid, and $F_{\mathrm{proto}}$ the protocol fee recorded by the ledger. Each layer is reported in basis points of $V$.

**Cost to users on confidential settlement.** Each confidential quote uses a fresh account that sends an amount $X$ of token $A$ to the bridge treasury and later receives an amount $Y$ of token $B$ from it. Valuing both at the price of the release, the all-in cost of quote $q$ is

$$c_q = \frac{v(X_q, t_q) - v(Y_q, t_q)}{v(X_q, t_q)}, \tag{4}$$ <<E:allin>>

and the value-weighted cost of a set $Q$ of quotes is $\bar{c} = \sum_{q\in Q}\big(v(X_q) - v(Y_q)\big) / \sum_{q \in Q} v(X_q)$. When $A$ and $B$ are the same asset on different chains, $p_A = p_B$ and (4) reduces to $(X_q - Y_q)/X_q$, which needs no price at all. The measure includes every fee charged on the confidential ledger and the solver spread. It cannot separate them.

**Uncertainty.** Intervals are 95 % percentile intervals from 2,000 bootstrap resamples, of windows for (1) and of quotes for $\bar{c}$, with fixed seeds. The algebraic facts used above (the cancellation of the scale factor in ratios, the price-free reduction of (4) and the bound of a value-weighted mean by its largest term) and the arithmetic of derived figures were checked in a proof assistant.

**Value accrual.** For a stream $x$ that reaches NEAR holders, in dollars per day, its offset of dilution is

$$o(x) = \frac{x}{s \, i \, P / 365}, \tag{5}$$ <<E:offset>>

where $s$ is the token supply, $i$ the maximum annual inflation rate and $P$ a reference NEAR price. The streams are the intent-system buyback, burnt gas and on-chain arbitrage, the last being an upper bound on what an order auction could capture. At a holders' share of $h$ basis points of intent volume, buyback and burn $b$ together match issuance at a volume of $(s \, i \, P / 365 - b) / (h \cdot 10^{-4})$.

**Validators.** To test whether block producers favor winning arbitrage, we compare the producers of the chunks that included winning back-runs with each shard's producer mix at random heights in the same windows (a Monte Carlo chi-square test), and with failed attempts by the same bots (a label permutation within shard and window).

## V. Setup

The range is blocks 223,455,000 to 224,500,000, about seven days from 2026-11-07 to 2026-11-14. Swaps on the exchange were parsed from execution logs of every receipt in the sampled windows. Intent-ledger events were read for every sampled transaction carrying a balance-difference intent, and a random sample of 2,000 transactions from the same windows was used to estimate coverage and to draw the confidential quotes. For each confidential quote, all transactions of its account within 20,000 blocks of the sampled transaction were read, which recovers the deposit, the transfer to the treasury, the release and the withdrawal. Prices are one-minute closes from a public exchange feed. All data are public and were read through public archival and indexer interfaces. The hypotheses and kill criteria were registered in three stages, each before the data it concerns were read; the first stage followed a short pilot. The baseline that excludes the event, the app-fee layer, the confidential-route cost, the validator test and the value-accrual model were added after registration and are not registered results. The departures are listed in the companion whitepaper, which serves as the supplement. Every figure below, except the fee configuration, chunk headers and wallet facts read live from a node or an explorer, is recomputed from the stored data by an offline script with a pass or fail result per figure. The data, the analysis code, the checks and the proofs are public with the paper.

## VI. Results

### A. On-chain arbitrage is small and concentrated

Excluding one six-minute event, cyclic arbitrage on the exchange earns about $347 per day (95 % interval $171–564), or 0.44 basis points of priced volume. The registered estimator over all windows gives $1,247 per day, because a single window holds 72 % of the week's profit. In that window a contract router pushed size through thin pools and bots closed the gaps it opened, competing by speed and retries. Three operators take half of all profit, and 62 % outside the event. Back-runs earn 39 % of profit. Of 467 same-pool sandwich patterns, none survives review as an attack. At a hundred times its current size, arbitrage would be 39 % of the chain's maximum issuance, which triggered a registered kill criterion: the hypothesis that it would stay below 1 % of issuance even at that scale is rejected. It would take about 2.6 times today's arbitrage to reach 1 %.

### B. Validators receive no fee share and show no detectable preference

Transaction fees are burnt [@neargas], the share of fees paid to called contracts is zero, and every chunk header of the one block we inspected in the range reports a zero validator reward. Over the full week, the producers of the chunks that included 500 winning back-runs do not differ significantly from each shard's producer schedule, although the test is borderline (Monte Carlo p = 0.08). Compared with failed attempts by the same bots within each shard alone, winners differ (permutation p = 0.02), but once the comparison is made within the same window no difference remains (p = 0.23), which points to the producer schedule rotating over the week. Of 4,755 chunk lookups, 3.6 % failed and are excluded. We therefore find no detectable preference of block producers for the winning transactions.

### C. Users on public intent settlement pay mostly app fees

**TABLE I** User cost on public intent settlement, in basis points of priced user volume at mid.

| Layer | bps |
|---|---|
| Integrator and app fees | 24.1 |
| Solver spread | 8.1ᵃ |
| Protocol fee | 0.03 |
| Total | 32.2 |

ᵃ Its 95 % interval includes zero, and one trade carries 61 % of it.

As Table I shows, app fees carried in the user's own signed intent are three quarters of the cost. They stay the largest layer under every solver definition we tried (18–27 bps), while the solver spread moves between −1.6 and 10.7 bps. Small trades pay most: under $100 the cost is 117 bps. This settlement route is, however, only about 1 % of the volume an aggregator reports for the intent system.

### D. Confidential settlement costs users a similar fee layer

**TABLE II** All-in user cost of confidential quotes, value-weighted, in basis points of the value sent in (194 priced quotes).

| Quotes | bps | 95 % interval |
|---|---|---|
| All | 21.7 | 10.5–51.1 |
| Same asset across chains (price-free) | 3.6 | 2.2–7.2 |
| Other non-stablecoin pairs | 51.8 | 32.6–132.7 |

The confidential route carries a large share of the intent system's transactions, and its quotes come back a median of eight seconds after the deposit. Table II gives their all-in cost. The price-free same-asset figure sits close to the documented one basis point charged on such routes, and the non-stablecoin figure is consistent with the documented 20 basis point default plus integrator fees and spread. The typical quote is small and pays about 55 basis points. The value-weighted figure is pulled down by a few large stablecoin and bitcoin quotes. Pricing more tokens and valuing one stablecoin at market moves the overall figure to 26.1 basis points and leaves the conclusions unchanged. Scaled to the week, users pay about $69,000 a day on this route, about fifteen times the cost on public settlement and about two hundred times on-chain arbitrage at baseline.

### E. Of the measured streams, only the intent-fee buyback is large against issuance

**TABLE III** Streams reaching NEAR holders, as a share of issuance (last 30 days, dollars per day at the study week's median price unless stated).

| Stream | $/day | % of issuance |
|---|---|---|
| NEAR accumulated in revenue wallets, on chain | 13,509 NEAR | 15.0 |
| Intent-system buyback, aggregator's attribution | 60,071 | 18.6 |
| Burnt gas | 3,021 | 0.9 |
| On-chain arbitrage, baseline | 347 | 0.1 |
| On-chain arbitrage, with the spike | 1,247 | 0.4 |

Issuance is about $323k a day at a supply of 1.31 billion NEAR, 2.5 % maximum inflation and $3.60 [@llama]. As Table III shows, NEAR builds up on chain in the buyback and revenue wallets at 15.0 % of issuance, a measurement that needs no price and no attribution.

The aggregator counts as holders' revenue the NEAR swept into those wallets and attributes it to intent-system fees. On that basis the buyback is about twenty times burnt gas and about 170 times baseline arbitrage, and holders receive 4.75 basis points of intent volume, roughly 15–22 % of what users pay on the paths measured above. The wallet's recent inflows are NEAR transfers out of the intent ledger. We did not trace where or at what price that NEAR was acquired, so the price paid and the link to fee revenue rest on that attribution. The NEAR is held in the wallets, not burned. Purchases visible on chain amount to about 2.7 % of issuance, a lower bound [@nearparity].

At the 30-day fee rate of 16.5 basis points and a holders' share of 28.8 % of fees, buybacks and burn would equal issuance in size at about 5.3 times today's volume, a comparison of flows and not of supply, since only the burn removes NEAR. Since the buyback began on 2026-02-23 it has averaged 9.6 % of issuance.

## VII. Discussion

The evidence also cuts against parts of the case. The public intent route measured in detail is only about 1 % of the volume an aggregator reports for the intent system, so its cost stack describes a slice, not the market. Two registered kill criteria were triggered: arbitrage at a hundred times its size would matter against issuance, and users of the intent ledger pay more against mid than the exchange loses to arbitrage, so intents are not the cheaper venue on that measure. Solver spread cannot be told apart from zero, and one trade carries most of it. Directional flow as a whole loses against later external prices, but the accounts that gained in the first half of the week earn about $1,000 a day in the second half, a rough figure that may exceed on-chain arbitrage. None of these reverses the ranking of value streams, but each limits how far the numbers generalize.

## VIII. Limitations

The confidential ledger hides who receives the fee and how much of the cost is solver spread, so for most of the intent system's volume we know only the total. One fifth of the sampled confidential quotes had no release within the search span and are excluded. If they are refunds or slow fills, their cost is missing. Tokens without an external price, mostly bridged assets of one provider, are excluded from both intent measures, and stablecoins at par add a few basis points of error to stablecoin pairs. The attribution of app fees to the transfers signed under the user's intent is a judgment, although no such transfer goes to a counterparty of the trade. The aggregator's volume series cannot be checked for double counting, so the share of volume covered is approximate. The sandwich search covered the same-pool shape only. The value-accrual model rests on the aggregator's fee and revenue series, a single week's reference price and the maximum inflation rate, and the buyback is a policy that can change. The buyback wallet holds about 2.29 million NEAR, which we read on chain but did not reconcile with the aggregator's series. A lower issuance ceiling approved by governance would raise every offset once it takes effect [@hsp029]. The pre-registration was publicly timestamped about two hours after its hash was taken.

## IX. Conclusion

On a chain that does not sell transaction order, we find that:
1. For a long-term holder, the intent-fee buyback is the only measured stream from trading that is large against issuance, so the investment case for NEAR rests on intent volume, its fee rate and the holders' share, not on selling blockspace or order.
2. Order-based extraction on the on-chain exchange is small next to what users pay to trade, and is concentrated in a few bots that compete by speed rather than payment.
3. Validators receive no fee share by protocol rule and no detectable share through block production.
4. On public intent settlement, the largest cost to users is the app fee carried in their own signed intent, not solver spread or protocol fee.
5. On confidential settlement, which carries more of the intent system's transactions than public settlement, users pay a fee layer of similar order that the chain cannot attribute.

Selling order would therefore capture little today. The economics of trading on this chain sit in the distribution layer, and the part of it that returns to holders is the number to watch. Future work should obtain the fee split on the confidential ledger, extend the sandwich search to multi-pool routes, and repeat the week to test whether router-driven events recur.


## References

@nep541: NEAR Protocol, "NEP-541: Transaction priority fee," GitHub pull request, closed 2025-09-22. https://github.com/near/NEPs/pull/541

@confidential: NEAR Intents documentation, "Confidential liquidity" and "Confidential intents," accessed 2026-11-14. https://docs.near-intents.org/integration/market-makers/confidential-liquidity

@fees: NEAR Intents documentation, "Fees" and "1Click fee configuration," accessed 2026-11-14. https://docs.near-intents.org/resources/fees

@twin: AloysJehwin (GitHub user), "Capture without churn," GitHub repository, 2026. https://github.com/AloysJehwin/near-capture-without-churn

@llama: DefiLlama, public API daily series for NEAR Intents volume, fees and holders' revenue and NEAR gas fees and burn, fetched 2026-11-14. https://api.llama.fi/summary/fees/near-intents

@daian2020: P. Daian, S. Goldfeder, T. Kell, Y. Li, X. Zhao, I. Bentov, L. Breidenbach and A. Juels, "Flash Boys 2.0: Frontrunning in decentralized exchanges, miner extractable value, and consensus instability," in Proc. IEEE Symp. Security and Privacy, 2020. https://arxiv.org/abs/1904.05234

@qin2021: K. Qin, L. Zhou and A. Gervais, "Quantifying blockchain extractable value: How dark is the forest?" arXiv:2101.05511, 2021. https://arxiv.org/abs/2101.05511

@zhou2020: L. Zhou, K. Qin, C. Ferreira Torres, D. V. Le and A. Gervais, "High-frequency trading on decentralized on-chain exchanges," arXiv:2009.14021, 2020. https://arxiv.org/abs/2009.14021

@milionis2022: J. Milionis, C. C. Moallemi, T. Roughgarden and A. L. Zhang, "Automated market making and loss-versus-rebalancing," arXiv:2208.06046, 2022. https://arxiv.org/abs/2208.06046

@heimbach2024: L. Heimbach, V. Pahari and E. Schertenleib, "Non-atomic arbitrage in decentralized finance," in Proc. IEEE Symp. Security and Privacy, 2024. https://arxiv.org/abs/2401.01622

@chitra2024: T. Chitra, K. Kulkarni, M. Pai and T. Diamandis, "An analysis of intent-based markets," arXiv:2403.02525, 2024. https://arxiv.org/abs/2403.02525

@bachu2024: B. Bachu, X. Wan and C. C. Moallemi, "Quantifying price improvement in order flow auctions," arXiv:2405.00537, 2024. https://arxiv.org/abs/2405.00537

@yuminaga2025: Y. Yuminaga, D. Chen and D. Sui, "Execution welfare across solver-based DEXes," arXiv:2503.00738, 2025. https://arxiv.org/abs/2503.00738

@zhang2026: R. Zhang, "Incentives and market structure in intent-based exchanges: Evidence from a solver-reward reform," in Proc. Int. Workshop Cryptocurrencies and Blockchain Technology (CBT), 2026. https://arxiv.org/abs/2607.21955

@roughgarden2020: T. Roughgarden, "Transaction fee mechanism design for the Ethereum blockchain: An economic analysis of EIP-1559," arXiv:2012.00854, 2020. https://arxiv.org/abs/2012.00854

@nearparity: Damianonyx (GitHub user), "NEARparity," GitHub repository, 2026. https://github.com/Damianonyx/NEARparity

@hsp029: D. Park, "NEAR governance approves proposal to cut token issuance ceiling to 1.6%," The Block, 2026-11-03. https://theblock.co/news/defi/2026-11-03-near-governance-approves-proposal-to-cut-token-issuance-432378

@neargas: NEAR documentation, "Gas," accessed 2026-11-14. https://docs.near.org/protocol/gas
