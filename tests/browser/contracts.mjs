// Synthetic UI contracts ONLY. Never chain evidence, yield verification or a production fallback.
export const keys = ["5Gsp2ZkPSCpdscVem8NsE6qEUyjEGSf6YtKx6j1hy1ToG9VM", "5E4z3h9yVhmQyCFWNbY9BPpwhx4xFiPwq3eeqmBgVF6KULde"];
export const stamp = new Date().toISOString();
const yesterday = Math.floor(Date.now() / 86400000) * 86400000 - 86400000;
export const markets = Array.from({ length: 128 }, (_, index) => ({
  netuid: index + 1, name: index === 50 ? "Smoke Lium" : `Smoke Subnet ${index + 1}`, symbol: "α", time: stamp,
  block_number: 9000000, price_tao: "0.1", price_10m_tao: "0.1", price_1h_tao: "0.1", price_24h_tao: "0.1", price_7d_tao: "0.1",
  time_1h: new Date(Date.parse(stamp) - 3600000).toISOString(), time_24h: new Date(Date.parse(stamp) - 86400000).toISOString(),
  tao_reserve: "1000", alpha_reserve: "10000", circulating_alpha: "110000", alpha_out: "100000", market_cap_tao: "11000",
  volume_24h_tao: "10", volume_1h_tao: "1", volume_acceleration_1h: "1", volume_acceleration_24h: "1",
  change_10m: "0", change_1h: "0", change_24h: "0", change_7d: "0", liquidity_change_1h: "0", liquidity_change_24h: "0",
  emission_pct: "0.78125", emission_change_24h: "0", emission_change_1h: "0", conviction_locked_alpha: "0", conviction_locked_pct: "0",
  apy: index === 102 ? "20000" : "20", apr: index === 102 ? "530" : "18", yield_basis: "latest-epoch-estimate", tempo: 360, staker_epoch_dividends_alpha: "1",
}));
export function history(index = 0) {
  return Array.from({ length: 91 }, (_, i) => ({ day: new Date(yesterday - (90 - i) * 86400000).toISOString().slice(0, 10), timestamp: stamp, twr_first_block: "100", twr: 1 + i * .001, nav_per_share: i === 80 ? .9686 - index * .001 : 1 }));
}
export const baskets = keys.map((hotkey, index) => ({ hotkey, name: `Smoke Validator ${index + 1}`, timestamp: stamp, identityTimestamp: stamp, block_number: 9000000, nav_tao: "100000000000", spot_nav_tao: "100000000000", root_stake: "1000000000000", take: .09, deposited_tao: "100000000000", redeemed_tao: "0", shares: "100", performance: 1, return_7d: -.01, return_30d: -.02, staker_return_7d: .001, staker_return_30d: .004, holdings: [{ netuid: 51, alpha: "100000000000", realizable_tao: "100000000000", spot_tao: "100000000000" }] }));
export const candidates = keys.map((hotkey, index) => ({ hotkey, name: `Smoke Validator ${index + 1}`, operation: "direct", take: .09, yield7: .3, yield30: .3, apr7: .26, apr30: .26, yieldBasis: "chain-net", yieldBlock: 9000000, participation7: 1, participation30: 1, active: true, permit: true, updated: 5, cutoff: 500, stakeShare: .1, dividends: .1, registered: "2025-01-01", timestamps: Array(4).fill(stamp) }));
export const validators = keys.map((hotkey, index) => ({ hotkey, coldkey: hotkey, name: `Smoke Validator ${index + 1}`, rank: index + 1, active_subnets: 5, global_nominators: 10, take: ".09", global_weighted_stake: "100000000000", root_stake: "100000000000", weighted_root_stake: "100000000000", global_alpha_stake_as_tao: "100000000000", dominance: "1", global_weighted_stake_24_hr_change: "0", dominance_24_hr_change: "0", global_nominators_24_hr_change: 0, nominator_return_per_day: "1", validator_return_per_day: "1", root_rank: index + 1, alpha_rank: index + 1, created_on_date: "2025-01-01", block_number: 9000000, timestamp: stamp }));
export const pagination = { current_page: 1, next_page: null, prev_page: null, total_items: 2, total_pages: 1 };
export function chart(interval) {
  const seconds = ({ "10m": 600, "1h": 3600, "1d": 86400, "1w": 604800, "1mo": 2678400 })[interval] || 86400;
  const end = Math.floor(Date.now() / 1000 / seconds) * seconds;
  return { method: "ci-contract-fixture", done: true, data: Array.from({ length: 90 }, (_, i) => [new Date((end - (89 - i) * seconds) * 1000).toISOString(), ".09", ".11", ".08", ".1", "1"]) };
}
export const cachedWallets = keys.map(address => ({ address, free_tao: "1", staked_tao_value: "0", total_tao_value: "1", stakes: [] }));
