import { writeFile } from 'node:fs/promises';
const [first, last, output] = process.argv.slice(2);
const from = Number(first), to = Number(last);
if (!output || !Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from < 9476686 || to < from || to - from > 100000) throw Error('Usage: node scripts/collect-gamma-events.mjs FROM_FINALIZED_BLOCK TO_FINALIZED_BLOCK OUTPUT.json (maximum 100000-block range)');
const names = ['GammaMinted','GammaEmissionMinted','GammaSpent','GammaMoved','GammaDepositClosed','GammaDepositSpenderSet','GammaDepositDailySpendCapSet','GammaSpendSkipped','ServiceSet','ServiceRemoved','SubnetGammaEmissionSet'];
const result = { fromBlock: from, toBlock: to, source: 'TaoStats indexed SubtensorModule events', complete: false, counts: {}, events: [] };
for (const name of names) {
  let page = 1, total, rows = [];
  while (page) {
    const url = new URL('/api/gamma/events', process.env.GAMMA_AUDIT_BASE || 'https://shizzyunchained.com');
    for (const [key,value] of Object.entries({name,from,to,page})) url.searchParams.set(key,String(value));
    const response = await fetch(url, {signal:AbortSignal.timeout(30000)});
    if (!response.ok) throw Error(`${name} page ${page}: HTTP ${response.status}`);
    const body = await response.json();
    if (!Array.isArray(body.data) || !body.pagination || body.pagination.current_page !== page) throw Error('Invalid event pagination');
    if (total !== undefined && total !== body.pagination.total_items) throw Error('Provider totals changed during the fixed-range review');
    total = body.pagination.total_items; rows.push(...body.data);
    const next = body.pagination.next_page;
    if (next !== null && next !== page + 1) throw Error('Noncontiguous event pagination');
    page = next;
  }
  if (rows.length !== total || new Set(rows.map(r=>r.id)).size !== rows.length || rows.some(r=>r.name!==name || r.pallet!=='SubtensorModule' || r.block_number<from || r.block_number>to)) throw Error(`Incomplete or invalid ${name} evidence`);
  result.counts[name] = rows.length; result.events.push(...rows);
}
result.complete = true;
await writeFile(output,JSON.stringify(result,null,2)+'\n');
console.log(`Collected ${result.events.length} indexed events. Verify chain execution before updating published totals.`);
