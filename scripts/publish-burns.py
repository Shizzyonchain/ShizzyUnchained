"""Build the public archive from reviewed, complete finalized event scans."""
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path


def records(scan, names):
    if scan.get('errors') or scan['scannedThrough'] != scan['toBlock']:
        raise ValueError('Cannot publish an incomplete event scan')
    result = []
    for item in scan['events']:
        event = item['event']
        idx, kind = event['extrinsic_idx'], event['event_id']
        peers = item['sameExtrinsicEvents']
        if idx is None or not any(e['module_id'] == 'System' and e['event_id'] == 'ExtrinsicSuccess' for e in peers):
            continue
        if kind == 'AlphaBurned' and event['module_id'] == 'SubtensorModule':
            account, hotkey, amount, netuid = event['attributes']
            marker = None
            position = next(i for i, e in enumerate(peers) if e == event)
            # The matching buyback marker follows its burn. Never count it twice.
            for peer in peers[position + 1:]:
                if peer['module_id'] == 'SubtensorModule' and peer['event_id'] == 'AlphaBurned':
                    break
                if peer['module_id'] == 'SubtensorModule' and peer['event_id'] == 'AddStakeBurn':
                    a = peer['attributes']
                    if a['netuid'] == netuid and a['alpha'] == amount and a['hotkey'] == hotkey:
                        marker = a
                        break
            label, tao = ('buyback', str(marker['amount'])) if marker else ('alpha', None)
        elif kind == 'Burned' and event['module_id'] == 'Balances':
            account, amount = event['attributes']['who'], event['attributes']['amount']
            netuid, label, tao = None, 'tao', None
        else:
            continue
        if int(amount) <= 0:
            continue
        result.append(dict(id=f"{item['block']}-{item['eventIndex']}", block=item['block'], hash=item['hash'], extrinsic=idx, eventIndex=item['eventIndex'], eventName=event['module_id'] + '.' + kind, timestamp=datetime.fromtimestamp(item['timestamp'] / 1000, timezone.utc).isoformat(), netuid=netuid, name=names.get(str(netuid), 'Unknown') if netuid is not None else 'TAO', kind=label, amountRaw=str(amount), taoSpentRaw=tao, account=account))
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('scans', nargs='+')
    parser.add_argument('--output', default='app/data/burns.json')
    parser.add_argument('--history-start', required=True)
    args = parser.parse_args()
    scans = sorted([json.loads(Path(p).read_text(encoding='utf-8-sig')) for p in args.scans], key=lambda x: x['fromBlock'])
    for a, b in zip(scans, scans[1:]):
        if b['fromBlock'] > a['toBlock'] + 1:
            raise ValueError('Gap between scan intervals')
    target = Path(args.output)
    old = json.loads(target.read_text(encoding='utf-8')) if target.exists() else None
    if old and scans[0]['fromBlock'] > old['toBlock'] + 1:
        raise ValueError('Gap since prior archive')
    if old and max(s['toBlock'] for s in scans) < old['toBlock']:
        raise ValueError('Refusing to regress archive coverage')
    names = json.loads(Path('app/data/etao.json').read_text(encoding='utf-8'))['names']
    merged = {r['id']: r for r in old['transactions']} if old else {}
    for scan in scans:
        for row in records(scan, names):
            merged.setdefault(row['id'], row)
    last = max(scans, key=lambda s: s['toBlock'])
    data = dict(version=1, checkedAt=datetime.now(timezone.utc).isoformat(), fromBlock=old['fromBlock'] if old else scans[0]['fromBlock'], toBlock=last['toBlock'], hash=last['finalizedHash'], throughTime=datetime.fromtimestamp(last['chainTime'] / 1000, timezone.utc).isoformat() if last.get('chainTime') else (old.get('throughTime') if old and old['toBlock'] == last['toBlock'] else None), historyStart=old['historyStart'] if old else args.history_start, runtime=last['runtime'], source='Finalized Opentensor archive RPC event scan', coverageNote='Every finalized block in this archived interval was read for explicit alpha burns, buyback-burns and TAO balance burns using the relevant runtime decoder. Successful transaction events only; automatic miner emissions and recycling excluded. Public entries require at least 100 native tokens per individual event. Earlier history has not been backfilled.', transactions=sorted(merged.values(), key=lambda x: (x['block'], x['eventIndex']), reverse=True))
    target.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print('Published archive records:', len(merged))
