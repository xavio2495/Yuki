// NEAR shard assignment from a V2/V3 shard layout: accounts are split by sorted boundary accounts
// (account < boundary[0] -> index 0; boundary[i-1] <= account < boundary[i] -> index i), then index -> shard id.
export function shardOf(layout, account) {
  const L = layout.V3 || layout.V2;
  let idx = 0; for (const b of L.boundary_accounts) if (account >= b) idx++;
  return L.shard_ids[idx];
}
