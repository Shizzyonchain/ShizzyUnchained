"""Offline finalized eTAO + transaction-burn scan. Read-only; no visitor RPC.

Refuses runtime/layout changes and incomplete batches. Review unsupported metadata
before extending coverage; a snapshot match is never evidence of zero events.
"""
import argparse
import json
import os
from datetime import datetime, timezone
from pathlib import Path

import websocket
from scalecodec.base import ScaleBytes
from substrateinterface import SubstrateInterface

TARGETS = {('SubtensorModule', name) for name in ['SubnetEmissionWeightsSet', 'AlphaBurned', 'AddStakeBurn', 'AlphaRecycled']}
TARGETS.add(('Balances', 'Burned'))
EVENT_KEY = '0x26aa394eea5630e07c48ae0c9558cef780d41e5e16056765bc8461851072c9d7'


def rpc_batch(socket, method, params):
    socket.send(json.dumps([dict(jsonrpc='2.0', id=i, method=method, params=p) for i, p in enumerate(params)]))
    rows = json.loads(socket.recv())
    if not isinstance(rows, list) or len(rows) != len(params):
        raise ValueError('Incomplete RPC batch')
    if {x.get('id') for x in rows} != set(range(len(params))) or any('error' in x or 'result' not in x for x in rows):
        raise ValueError('Invalid or failed RPC batch')
    return [x['result'] for x in sorted(rows, key=lambda row: row['id'])]


def metadata_layout(metadata):
    types = {item['id']: item for item in metadata['types']['types']}
    definitions, needles, event_type = [], [], None
    for pallet in metadata['pallets']:
        if pallet['name'] == 'System':
            event_type = next(x['type']['Plain'] for x in pallet['storage']['entries'] if x['name'] == 'Events')
        if not pallet.get('event'):
            continue
        for event in types[pallet['event']['ty']]['type']['def']['variant']['variants']:
            if (pallet['name'], event['name']) in TARGETS:
                definitions.append(dict(pallet=pallet['name'], palletIndex=pallet['index'], event=event))
                needles.append(bytes([pallet['index'], event['index']]))
    if len(definitions) != len(TARGETS) or event_type is None:
        raise ValueError('Required runtime event definitions missing')
    return definitions, needles, event_type


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--from-block', type=int, required=True)
    parser.add_argument('--to-block', type=int)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    # Load only the configured read-only RPC, never print it or other secrets.
    env = Path('.env.local')
    if env.exists():
        for line in env.read_text(encoding='utf-8-sig').splitlines():
            if line.startswith('ETAO_RPC_URL=') and not os.environ.get('ETAO_RPC_URL'):
                os.environ['ETAO_RPC_URL'] = line.split('=', 1)[1].strip().strip('\"\'')
    endpoint = os.environ.get('ETAO_RPC_URL') or 'wss://archive.chain.opentensor.ai:443'
    chain = SubstrateInterface(url=endpoint, ws_options={'timeout': 30})
    final = chain.get_chain_finalised_head()
    finalized = chain.get_block_number(final)
    end = args.to_block or finalized
    if args.from_block < 2 or not args.from_block <= end <= finalized:
        raise ValueError('Invalid finalized interval')
    head = chain.get_block_hash(end)
    chain.init_runtime(block_hash=head)
    runtime = chain.rpc_request('state_getRuntimeVersion', [head])['result']['specVersion']
    current = chain.metadata.value[1]['V14']
    prior = chain.get_metadata(block_hash=chain.get_block_hash(args.from_block - 1)).value[1]['V14']
    definitions, needles, event_type = metadata_layout(current)
    # Full portable types plus target definitions must match the last reviewed boundary.
    if current['types'] != prior['types'] or definitions != metadata_layout(prior)[0]:
        raise ValueError('Runtime metadata changed: review and split the interval before decoding')
    if runtime != 484:
        raise ValueError('Runtime not reviewed: inspect definitions and execution semantics before extending coverage')
    # Positive controls exercise real indexed event decoding, not just byte matching.
    for block, name in [(9325968, 'SubnetEmissionWeightsSet'), (9354416, 'AlphaBurned')]:
        events = chain.get_events(block_hash=chain.get_block_hash(block))
        values = [row.value.get('event', row.value) for row in events]
        if not any(value.get('event_id') == name for value in values):
            raise ValueError('Known event decoding control failed')
    chain.init_runtime(block_hash=head)
    baseline = json.loads(Path('app/data/etao.json').read_text(encoding='utf-8'))
    weights = {str(key.value): [str(n) for n in value.value] for key, value in chain.query_map('SubtensorModule', 'SubnetEmissionWeights', block_hash=head, page_size=256)}
    out = dict(checkedAt=datetime.now(timezone.utc).isoformat(), fromBlock=args.from_block, toBlock=end, finalizedHash=head, runtime=runtime, chainTime=chain.query('Timestamp', 'Now', block_hash=head).value, source='Configured chain RPC' if os.environ.get('ETAO_RPC_URL') else 'Opentensor archive RPC', metadataEventDefinitions=definitions, metadataReview='Runtime 484; target event definitions and full portable types equal to previous reviewed boundary; each scanned block runtime checked; known eTAO and burn event controls decoded.', scannedThrough=args.from_block-1, events=[], errors=[], weights=weights, differences=[dict(netuid=k, before=baseline['weights'].get(k), after=weights.get(k)) for k in sorted(set(weights) | set(baseline['weights']), key=int) if weights.get(k) != baseline['weights'].get(k)])
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    socket = websocket.create_connection(endpoint, timeout=45)
    try:
        for start in range(args.from_block, end+1, 40):
            try:
                numbers = list(range(start, min(start+40, end+1)))
                hashes = rpc_batch(socket, 'chain_getBlockHash', [[n] for n in numbers])
                versions = rpc_batch(socket, 'state_getRuntimeVersion', [[h] for h in hashes])
                if any(v['specVersion'] != runtime for v in versions):
                    raise ValueError('Runtime boundary requires separate reviewed decoding')
                raw = rpc_batch(socket, 'state_getStorage', [[EVENT_KEY, h] for h in hashes])
                for number, block_hash, encoded in zip(numbers, hashes, raw):
                    if not encoded:
                        raise ValueError('Missing event storage')
                    if not any(needle in bytes.fromhex(encoded[2:]) for needle in needles):
                        continue
                    chain.init_runtime(block_hash=block_hash)
                    rows = chain.runtime_config.create_scale_object(f'scale_info::{event_type}', data=ScaleBytes(encoded), metadata=chain.metadata).decode()
                    targets = [(i, event) for i, event in enumerate(rows) if (event['module_id'], event['event_id']) in TARGETS]
                    if targets:
                        stamp = chain.query('Timestamp', 'Now', block_hash=block_hash).value
                        for index, event in targets:
                            out['events'].append(dict(block=number, hash=block_hash, timestamp=stamp, eventIndex=index, event=event, sameExtrinsicEvents=[e for e in rows if e['extrinsic_idx'] == event['extrinsic_idx']]))
                out['scannedThrough'] = numbers[-1]
            except Exception as error:
                # Do not record RPC addresses/credentials in errors.
                out['errors'].append(dict(start=start, end=min(start+39, end), error=type(error).__name__))
                break
            output.write_text(json.dumps(out, indent=2, default=str), encoding='utf-8')
            if (start-args.from_block) % 400 == 0:
                print('SCANNED', out['scannedThrough'], 'TARGET EVENTS', len(out['events']), flush=True)
    finally:
        socket.close()
        chain.close()
    out['completedAt'] = datetime.now(timezone.utc).isoformat()
    out['complete'] = not out['errors'] and out['scannedThrough'] == end
    output.write_text(json.dumps(out, indent=2, default=str), encoding='utf-8')
    print('DONE', out['complete'], 'THROUGH', end, 'TARGET EVENTS', len(out['events']), 'VECTOR CHANGES', len(out['differences']), flush=True)
    if not out['complete']:
        raise SystemExit('Incomplete scan: resolve recorded gaps before publication')


if __name__ == '__main__':
    main()
