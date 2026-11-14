import Mathlib

/-!
# Yuki: algebraic and arithmetic facts behind the measured claims

Lean cannot check on-chain measurements. It checks the algebra that turns them into claims, and the arithmetic of
derived numbers quoted in prose. Literal values are copied from the committed results files
(`results/hub-quotes.json`, `results/intents.json`, `results/coverage.json`, `results/rhea.json`).
-/

namespace Yuki

open Finset

/-- All-in cost in basis points: value sent in, value received back, both valued at the same prices. -/
def costBps (vin vout : ℚ) : ℚ := (vin - vout) / vin * 10000

/-- Same-asset routes: the cost does not depend on the price used, so it needs no price data. -/
theorem sameAsset_priceFree (x y p : ℚ) (hp : p ≠ 0) :
    costBps (x * p) (y * p) = (x - y) / x * 10000 := by
  unfold costBps
  rw [← sub_mul, mul_div_mul_right _ _ hp]

/-- A ratio of sample sums does not change when both sums are scaled to per-day values by the same factor. -/
theorem ratio_scale_invariant (k num den : ℚ) (hk : k ≠ 0) :
    (k * num) / (k * den) = num / den :=
  mul_div_mul_left num den hk

/-- A value-weighted mean cost is at most the largest per-quote cost (weights are non-negative volumes). -/
theorem weightedMean_le_max {ι : Type*} (s : Finset ι) (w c : ι → ℚ) (M : ℚ)
    (hw : ∀ i ∈ s, 0 ≤ w i) (hpos : 0 < ∑ i ∈ s, w i) (hM : ∀ i ∈ s, c i ≤ M) :
    (∑ i ∈ s, w i * c i) / (∑ i ∈ s, w i) ≤ M := by
  rw [div_le_iff₀ hpos]
  calc ∑ i ∈ s, w i * c i ≤ ∑ i ∈ s, w i * M :=
        sum_le_sum fun i hi => mul_le_mul_of_nonneg_left (hM i hi) (hw i hi)
    _ = M * ∑ i ∈ s, w i := by rw [← sum_mul, mul_comm]

/-- Treasury path: the all-quotes figure (21.65 bps) is the volume-weighted mix of the stable-to-stable
(-1.25 bps on $246,848.19) and other-pair (51.78 bps on $187,631.33) slices, up to rounding of the inputs. -/
theorem treasury_mix :
    |(246848.19 * (-1.25) + 187631.33 * 51.78) / 434479.51 - (21.65 : ℚ)| < 0.01 := by
  norm_num [abs_lt]

/-- Coverage: priced token_diff volume ($1,373,172.23/day) is 0.98 % of DefiLlama's mean ($139,960,091/day). -/
theorem tokenDiff_share : |1373172.23 / 139960091 * 100 - (0.98 : ℚ)| < 0.005 := by
  norm_num [abs_lt]

/-- "About 15x": Treasury-path user cost ($68,538/day) over token_diff user cost ($4,416.26/day). -/
theorem treasury_vs_tokenDiff : (15 : ℚ) < 68538 / 4416.26 ∧ 68538 / 4416.26 < (16 : ℚ) := by
  norm_num

/-- KC5: arbitrage is 0.3856 % of issuance, so it must grow about 2.6x to reach 1 %. -/
theorem kc5_growth : |1 / 0.3856 - (2.6 : ℚ)| < 0.05 := by
  norm_num [abs_lt]

end Yuki
