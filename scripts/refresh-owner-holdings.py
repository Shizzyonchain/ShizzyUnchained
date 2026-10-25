"""Refresh all subnet owner holdings offline at one finalized block. No visitor RPC."""
import argparse, json, os
from datetime import datetime, timezone
from pathlib import Path
from subnet_fundamentals import add_owner_emissions
from substrateinterface import SubstrateInterface
from substrateinterface.utils.ss58 import ss58_decode, ss58_encode

class ScaleReader:
 def __init__(self,data): self.data=bytes.fromhex(data.removeprefix('0x'));self.offset=0
 def take(self,n):
  if self.offset+n>len(self.data): raise ValueError('Truncated holdings evidence')
  out=self.data[self.offset:self.offset+n];self.offset+=n;return out
 def compact(self):
  first=self.take(1)[0];mode=first&3
  if mode==0:return first>>2
  if mode in (1,2):return int.from_bytes(bytes([first])+self.take(1 if mode==1 else 3),'little')>>2
  return int.from_bytes(self.take((first>>2)+4),'little')

def compact(n):
 if n<64:return bytes([n<<2])
 if n<16384:return ((n<<2)|1).to_bytes(2,'little')
 if n<1073741824:return ((n<<2)|2).to_bytes(4,'little')
 size=(n.bit_length()+7)//8;return bytes([((size-4)<<2)|3])+n.to_bytes(size,'little')

def decode_availability(raw,expected):
 r=ScaleReader(raw);out={}
 for _ in range(r.compact()):
  address=ss58_encode(r.take(32).hex(),42)
  if address not in expected or address in out:raise ValueError('Unexpected or duplicate owner')
  subnets={}
  for _ in range(r.compact()):
   sn=int.from_bytes(r.take(2),'little');total,locked,available=[r.compact() for _ in range(3)]
   if sn in subnets or locked>total or available>total:raise ValueError('Invalid stake availability')
   subnets[sn]={'total':total,'locked':locked,'available':available}
  out[address]=subnets
 if r.offset!=len(r.data) or set(out)!=set(expected):raise ValueError('Incomplete holdings evidence')
 return out

def decode_stake_total(raw,address,netuid):
 r=ScaleReader(raw);total=0;positions=0
 for _ in range(r.compact()):
  r.take(32);coldkey=r.take(32).hex();sn=r.compact();stake=r.compact()
  for _ in range(4):r.compact()
  registered=r.take(1)[0]
  if coldkey!=ss58_decode(address) or registered not in (0,1):raise ValueError('Invalid per-hotkey stake evidence')
  if sn==netuid:total+=stake;positions+=1
 if r.offset!=len(r.data):raise ValueError('Unconsumed per-hotkey stake evidence')
 return total,positions

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--output',default='app/data/owner-holdings.json');args=parser.parse_args()
 for line in Path('.env.local').read_text(encoding='utf-8-sig').splitlines():
  if line.startswith('ETAO_RPC_URL='):os.environ.setdefault('ETAO_RPC_URL',line.split('=',1)[1].strip().strip('\"\''))
 c=SubstrateInterface(url=os.environ.get('ETAO_RPC_URL','wss://archive.chain.opentensor.ai:443'),ws_options={'timeout':60})
 h=c.get_chain_finalised_head();block=c.get_block_number(h);c.init_runtime(block_hash=h)
 runtime=c.rpc_request('state_getRuntimeVersion',[h])['result']['specVersion']
 if runtime!=484:raise ValueError('Review runtime holdings schema before publishing this version')
 timestamp=int(c.query('Timestamp','Now',block_hash=h).value)
 registrations={int(k.value):int(v.value) for k,v in c.query_map('SubtensorModule','NetworkRegisteredAt',block_hash=h)}
 active=sorted(sn for sn in registrations if 1<=sn<=128)
 if len(active)!=128:raise ValueError('Review active roster before publishing incomplete holdings')
 keys=[c.create_storage_key('SubtensorModule','SubnetOwner',[sn]) for sn in active]
 values=c.query_multi(keys,block_hash=h)
 if len(values)!=len(keys):raise ValueError('Incomplete owner response')
 owners={sn:str(value.value) for sn,(_,value) in zip(active,values)}
 addresses=sorted(set(owners.values()));availability={};evidence=[]
 for offset in range(0,len(addresses),8):
  batch=addresses[offset:offset+8];encoded=compact(len(batch))+b''.join(bytes.fromhex(ss58_decode(a)) for a in batch)+b'\x00'
  raw=c.rpc_request('state_call',['StakeInfoRuntimeApi_get_stake_availability_for_coldkeys','0x'+encoded.hex(),h])
  if 'error' in raw:raise ValueError('Stake availability runtime API failed')
  availability.update(decode_availability(raw['result'],batch));evidence.append({'owners':batch,'raw':raw['result']});print('Reviewed owner wallets',min(offset+8,len(addresses)),'/',len(addresses),flush=True)
 balances=c.query_multi([c.create_storage_key('System','Account',[a]) for a in addresses],block_hash=h)
 if len(balances)!=len(addresses):raise ValueError('Incomplete balances')
 balance_by_owner={a:v.value['data'] for a,(_,v) in zip(addresses,balances)}
 rows={}
 for sn,address in owners.items():
  stake=availability[address].get(sn,{'total':0,'locked':0,'available':0});balance=balance_by_owner[address]
  rows[str(sn)]={'address':address,'registeredAt':registrations[sn],'alphaRaw':str(stake['total']),'lockedAlphaRaw':str(stake['locked']),'unstakableAlphaRaw':str(stake['available']),'freeTaoRaw':str(balance['free']),'frozenTaoRaw':str(balance.get('frozen',0)),'rootTaoRaw':str(availability[address].get(0,{}).get('total',0))}
 emission_evidence=add_owner_emissions(c,h,rows)
 result={'version':1,'block':block,'hash':h,'runtime':runtime,'asOf':datetime.fromtimestamp(timestamp/1000,timezone.utc).isoformat(),'checkedAt':datetime.now(timezone.utc).isoformat(),'source':'Finalized Subtensor StakeInfoRuntimeApi stake availability and System.Account; one block for every wallet','subnets':rows}
 target=Path(args.output)
 if target.exists() and json.loads(target.read_text(encoding='utf-8'))['block']>block:raise ValueError('Refusing to regress owner holdings')
 proof=Path(f'public/evidence/owner-holdings-{block}.json');proof.parent.mkdir(parents=True,exist_ok=True)
 cross_checks=[]
 for sn in [51,64]:
  address=owners[sn];raw=c.rpc_request('state_call',['StakeInfoRuntimeApi_get_stake_info_for_coldkey','0x'+ss58_decode(address),h])['result']
  total,positions=decode_stake_total(raw,address,sn)
  if total!=int(rows[str(sn)]['alphaRaw']):raise ValueError('Independent alpha holdings cross-check failed')
  cross_checks.append({'netuid':sn,'address':address,'alphaRaw':str(total),'positions':positions,'raw':raw})
 proof.write_text(json.dumps({'snapshot':result,'stakeAvailability':evidence,'accountBalances':balance_by_owner,'crossChecks':cross_checks,'ownerEmissionRates':emission_evidence},indent=2)+'\n',encoding='utf-8')
 result['evidence']='/evidence/'+proof.name
 temporary=target.with_suffix('.tmp');temporary.write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8');temporary.replace(target)
 print('Published holdings:',len(rows),'subnets at finalized block',block)
if __name__=='__main__':main()
