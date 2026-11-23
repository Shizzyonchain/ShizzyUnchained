import json,time,sys,os
from pathlib import Path
from substrateinterface import SubstrateInterface
from scalecodec.base import ScaleBytes
import websocket
if len(sys.argv)!=3:raise SystemExit('Usage: verify-gamma-events.py INDEXED_EVENTS.json CHAIN_PROOF.json')
indexed_path=Path(sys.argv[1]);proof_path=Path(sys.argv[2]);p=proof_path.parent;d=json.loads(indexed_path.read_text());assert d['complete'];want={}
for e in d['events']:want.setdefault(e['block_number'],[]).append(e)
c=SubstrateInterface(url=os.environ.get('ETAO_RPC_URL','wss://archive.chain.opentensor.ai:443'),ws_options={'timeout':45});w=websocket.create_connection(os.environ.get('ETAO_RPC_URL','wss://archive.chain.opentensor.ai:443'),timeout=45);contexts={};proof=json.loads(proof_path.read_text())['events'] if proof_path.exists() else []
verified={(e['block'],e['index'])for e in proof}
want={n:[e for e in rows if (n,e['index'])not in verified]for n,rows in want.items()};want={n:rows for n,rows in want.items()if rows}
def batch(method,params):
 for attempt in range(5):
  w.send(json.dumps([{'jsonrpc':'2.0','id':i,'method':method,'params':a}for i,a in enumerate(params)]));r=json.loads(w.recv())
  if isinstance(r,list) and len(r)==len(params) and not any('error'in x for x in r):return [x['result']for x in sorted(r,key=lambda x:x['id'])]
  print('retry',method,[x.get('error')for x in r if isinstance(x,dict)and'error'in x]if isinstance(r,list)else r,flush=True);time.sleep(65)
 raise RuntimeError(method)
ns=sorted(want)
for a in range(0,len(ns),20):
 blocks=ns[a:a+20];hs=batch('chain_getBlockHash',[[n]for n in blocks]);raw=batch('state_getStorage',[['0x26aa394eea5630e07c48ae0c9558cef780d41e5e16056765bc8461851072c9d7',h]for h in hs]);parents=batch('chain_getBlockHash',[[n-1]for n in blocks]);versions=batch('state_getRuntimeVersion',[[h]for h in parents])
 for n,h,r,par,v in zip(blocks,hs,raw,parents,versions):
  ver=v['specVersion']
  if ver not in contexts:
   c.init_runtime(block_hash=par);m=c.metadata.value[1]['V14'];sys=next(x for x in m['pallets']if x['name']=='System');ty=next(x['type']['Plain']for x in sys['storage']['entries']if x['name']=='Events');contexts[ver]=(c.metadata,ty)
  metadata,ty=contexts[ver];ev=c.runtime_config.create_scale_object(f'scale_info::{ty}',data=ScaleBytes(r),metadata=metadata).decode()
  for indexed in want[n]:
   e=ev[indexed['index']];assert e['module_id']=='SubtensorModule'and e['event_id']==indexed['name'];assert e['attributes']=={k:(None if k=='daily_spend_cap' and value=='None' else value['Some'] if k=='daily_spend_cap' and isinstance(value,dict) and 'Some'in value else [(int(a),int(b))for a,b in value] if k=='shares' else bytes(value).decode('utf-8') if k=='url' and isinstance(value,list) else '0x'+bytes(value).hex() if k=='reference' and isinstance(value,list) else value)for k,value in indexed['args'].items()},(n,indexed['index'],'args mismatch',e['attributes'],indexed['args'])
   success=e['extrinsic_idx']is None or any(x['module_id']=='System'and x['event_id']=='ExtrinsicSuccess'and x['extrinsic_idx']==e['extrinsic_idx']for x in ev);assert success
   proof.append({'block':n,'hash':h,'runtime':ver,'index':indexed['index'],'type':indexed['name'],'attributes':e['attributes'],'successful':True})
 proof_path.write_text(json.dumps({'complete':False,'events':proof}));print('VERIFIED',len(proof),'events',a+len(blocks),'of',len(ns),'blocks',flush=True)
proof_path.write_text(json.dumps({'complete':True,'events':proof}));print('COMPLETE',len(proof),flush=True)
