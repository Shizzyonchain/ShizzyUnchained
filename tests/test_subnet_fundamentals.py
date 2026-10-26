import sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from subnet_fundamentals import owner_daily_rate,add_owner_emissions,U64_MAX
from types import SimpleNamespace
class OwnerEmissionTest(unittest.TestCase):
 def test_changed_owner_share_zero_and_per_block_rounding(self):
  owner=U64_MAX//10
  self.assertEqual(owner_daily_rate(10**9,[0,0,owner,0,U64_MAX-owner]),99_999_999*7200)
  self.assertEqual(owner_daily_rate(10**9,[0,0,0,0,U64_MAX]),0)
  self.assertEqual(owner_daily_rate(0,[0,0,owner,0,U64_MAX-owner]),0)
 def test_reject_invalid_weights(self):
  for weights in [[0,0,18,41,41],[0,0,U64_MAX],[0,0,-1,0,U64_MAX+1]]:
   with self.assertRaises(ValueError):owner_daily_rate(10**9,weights)
 def test_unstarted_subnet_reads_same_block_storage_default(self):
  class Chain:
   def query_map(self,*args,**kwargs):return []
   def create_storage_key(self,*args):return args
   def query_multi(self,keys,block_hash):return [(keys[0],SimpleNamespace(value=[0,0,U64_MAX,0,0]))]
   def query(self,*args,block_hash):
    self.request=(args,block_hash)
    return SimpleNamespace(value=0)
  chain=Chain();rows={'70':{}};proof=add_owner_emissions(chain,'finalized-hash',rows)
  self.assertEqual(chain.request,(('SubtensorModule','SubnetAlphaOutEmission',[70]),'finalized-hash'))
  self.assertEqual(rows['70']['ownerEmissionPerDayRaw'],'0')
  self.assertEqual(proof['70']['alphaOutEmissionRaw'],'0')
if __name__=='__main__':unittest.main()
