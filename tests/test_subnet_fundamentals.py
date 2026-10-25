import sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from subnet_fundamentals import owner_daily_rate,U64_MAX
class OwnerEmissionTest(unittest.TestCase):
 def test_changed_owner_share_zero_and_per_block_rounding(self):
  owner=U64_MAX//10
  self.assertEqual(owner_daily_rate(10**9,[0,0,owner,0,U64_MAX-owner]),99_999_999*7200)
  self.assertEqual(owner_daily_rate(10**9,[0,0,0,0,U64_MAX]),0)
  self.assertEqual(owner_daily_rate(0,[0,0,owner,0,U64_MAX-owner]),0)
 def test_reject_invalid_weights(self):
  for weights in [[0,0,18,41,41],[0,0,U64_MAX],[0,0,-1,0,U64_MAX+1]]:
   with self.assertRaises(ValueError):owner_daily_rate(10**9,weights)
if __name__=='__main__':unittest.main()
