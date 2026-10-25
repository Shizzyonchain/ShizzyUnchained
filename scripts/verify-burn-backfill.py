"""Independently verify indexed qualifying burns on finalized archive RPC."""
import json, os
from pathlib import Path
from datetime import datetime, timezone
from substrateinterface import SubstrateInterface
source=Path('public/evidence/burn-index-backfill-2026-09-22--2026-10-20.json')
out=Path('../research-oct24/burn-backfill-verified.json')
for line in Path('.env.local').read_text(encoding='utf-8-sig').splitlines():
 if line.startswith('ETAO_RPC_URL='): os.environ['ETAO_RPC_URL']=line.split('=',1)[1].strip().strip('"\'')
chain=SubstrateInterface(url=os.environ.get('ETAO_RPC_URL','wss://archive.chain.opentensor.ai:443'),ws_options={'timeout':60})
final=chain.get_chain_finalised_head(); finalized=chain.get_block_number(final)
d=json.loads(source.read_text(encoding='utf-8'))
proof=json.loads(out.read_text(encoding='utf-8')) if out.exists() else {'events':[], 'errors':[]}
seen={e['source']['id'] for e in proof['events']}
proof.update(sourceComplete=d['complete'],finalizedBlock=finalized,finalizedHash=final)
for stream in d['streams']:
 for row in stream['rows']:
  args=row['args'];amount=args[2] if row['name']=='AlphaBurned' else (args['amount'] if isinstance(args,dict) else args[1])
  if int(amount)<100000000000 or row['id'] in seen: continue
  block=int(row['block_number']);assert block<=finalized
  h=chain.get_block_hash(block); evs=[e.value for e in chain.get_events(block_hash=h)]
  idx=int(row['index']); event=evs[idx]; v=event.get('event',event)
  assert v['module_id']==row['pallet'] and v['event_id']==row['name'],row['id']
  a=v['attributes'];actual=a[2] if row['name']=='AlphaBurned' else a['amount']
  assert int(actual)==int(amount),row['id']
  if row['name']=='AlphaBurned': assert [str(x) for x in a]==[str(x) for x in args],row['id']
  ext=event.get('extrinsic_idx'); peers=[e for e in evs if e.get('extrinsic_idx')==ext]
  assert row['extrinsic_id']==f'{block}-{ext:04d}',row['id']
  assert ext is not None and any(e.get('event',e).get('event_id')=='ExtrinsicSuccess' for e in peers),row['id']
  stamp=int(chain.query('Timestamp','Now',block_hash=h).value)
  assert abs(stamp-datetime.fromisoformat(row['timestamp'].replace('Z','+00:00')).timestamp()*1000)<1000
  identity=None
  registered=None
  if row['name']=='AlphaBurned':
   try: identity=chain.query('SubtensorModule','SubnetIdentitiesV3',[int(a[3])],block_hash=h).value
   except Exception as error: raise ValueError('Historical identity unavailable') from error
   registered=chain.query('SubtensorModule','NetworkRegisteredAt',[int(a[3])],block_hash=h).value
  proof['events'].append({'source':row,'block':block,'hash':h,'eventIndex':idx,'timestamp':stamp,'event':dict(v,extrinsic_idx=ext),'sameExtrinsicEvents':[dict(e.get('event',e),extrinsic_idx=ext) for e in peers],'historicalIdentity':identity,'registeredAt':registered,'runtime':chain.runtime_version})
  out.write_text(json.dumps(proof,indent=2)+'\n',encoding='utf-8');print('Verified',row['id'],flush=True)
proof['checkedAt']=datetime.now(timezone.utc).isoformat();out.write_text(json.dumps(proof,indent=2)+'\n',encoding='utf-8')
print('Verified qualifying events',len(proof['events']))
