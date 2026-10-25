"""Merge complete indexed history only after every qualifying event is RPC verified."""
import json, hashlib, importlib.util
from pathlib import Path
from datetime import datetime,timezone
source=Path('public/evidence/burn-index-backfill-2026-09-22--2026-10-20.json')
proofpath=Path('../research-oct24/burn-backfill-verified.json')
d=json.loads(source.read_text(encoding='utf-8'));proof=json.loads(proofpath.read_text(encoding='utf-8'))
assert d['complete'] and not d['errors'] and proof['sourceComplete'] and not proof['errors']
assert {(s['pallet'],s['name']) for s in d['streams']}=={('SubtensorModule','AlphaBurned'),('Balances','Burned')}
qual={}
for stream in d['streams']:
 assert stream['complete'] and len(stream['rows'])==stream['total']
 ids=set(); offset=0
 for page in stream['pages']:
  rows=stream['rows'][offset:offset+page['count']];offset+=page['count']
  assert hashlib.sha256(json.dumps(rows,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()==page['sha256']
 assert offset==stream['total'] and [p['page'] for p in stream['pages']]==list(range(1,len(stream['pages'])+1))
 for r in stream['rows']:
  assert r['id'] not in ids;ids.add(r['id']);a=r['args'];amount=a[2] if r['name']=='AlphaBurned' else (a['amount'] if isinstance(a,dict) else a[1])
  if int(amount)>=100000000000: qual[r['id']]=r
assert set(qual)=={e['source']['id'] for e in proof['events']}
assert all(e['source']==qual[e['source']['id']] for e in proof['events'])
spec=importlib.util.spec_from_file_location('publisher','scripts/publish-burns.py');mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
archivepath=Path('app/data/burns.json');archive=json.loads(archivepath.read_text(encoding='utf-8'));oldcount=len(archive['transactions']);merged={r['id']:r for r in archive['transactions']}
for event in proof['events']:
 identity=event['historicalIdentity'];netuid=event['event']['attributes'][3] if event['event']['event_id']=='AlphaBurned' else None
 names={str(netuid):(identity or {}).get('subnet_name') or 'Unknown'}
 rows=mod.records({'errors':[],'scannedThrough':event['block'],'toBlock':event['block'],'events':[event]},names)
 assert len(rows)==1 and rows[0]['id']==f"{event['block']}-{event['eventIndex']}"
 for row in rows: merged.setdefault(row['id'],row)
assert d['end']>=datetime.fromisoformat(archive['historyStart']).timestamp()
archive['historyStart']=datetime.fromtimestamp(d['start'],timezone.utc).isoformat()
archive['checkedAt']=datetime.now(timezone.utc).isoformat()
archive['source']='Finalized archive RPC scans plus paginated historical event index, with qualifying burns independently verified on finalized chain'
archive['coverageNote']='September 22–October 20 history was reviewed using all 5,958 paginated TaoStats AlphaBurned records and the complete Balances.Burned query (0 records); every individual event of at least 100 native tokens was independently verified against finalized RPC events, successful execution, exact native amount, timestamp and historical subnet identity. From block 9,325,898 onward, every finalized block in the displayed full-block interval was scanned directly. Historical discovery depends on indexer completeness; it is not an independent full-block replay of the earlier interval. Miner emissions, fees and recycling are excluded. Public entries require at least 100 native tokens per individual event.'
archive['historicalReview']={'start':archive['historyStart'],'end':'2026-10-20T16:23:12+00:00','indexedRecords':5958,'qualifyingVerified':len(qual),'evidence':'/evidence/burn-backfill-finalized-2026-09-22--2026-10-20.json'}
archive['transactions']=sorted(merged.values(),key=lambda r:(r['block'],r['eventIndex']),reverse=True)
archivepath.write_text(json.dumps(archive,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
proof['sourceSha256']=hashlib.sha256(source.read_bytes()).hexdigest()
Path('public/evidence/burn-backfill-finalized-2026-09-22--2026-10-20.json').write_text(json.dumps(proof,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
print('Merged',len(merged)-oldcount,'historical qualifying burns; retained',oldcount,'existing records')
