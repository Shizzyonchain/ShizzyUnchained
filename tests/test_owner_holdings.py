import importlib.util,unittest
spec=importlib.util.spec_from_file_location('holdings','scripts/refresh-owner-holdings.py');h=importlib.util.module_from_spec(spec);spec.loader.exec_module(h)
class HoldingsDecoder(unittest.TestCase):
 def test_large_exact_stake_and_zero_wallet(self):
  rawaccount=bytes(range(32));address=h.ss58_encode(rawaccount.hex(),42)
  n=9007199254740993
  raw=h.compact(1)+rawaccount+h.compact(1)+(64).to_bytes(2,'little')+h.compact(n)+h.compact(0)+h.compact(n)
  self.assertEqual(h.decode_availability(raw.hex(),[address])[address][64]['total'],n)
  empty=h.compact(1)+rawaccount+h.compact(0)
  self.assertEqual(h.decode_availability(empty.hex(),[address]),{address:{}})
  for malformed in [raw[:-1],raw+b'\x00',h.compact(0)]:
   with self.assertRaises(ValueError):h.decode_availability(malformed.hex(),[address])
 def test_wrong_owner_and_lock_overflow_fail(self):
  account=bytes(range(32));address=h.ss58_encode(account.hex(),42)
  raw=h.compact(1)+account+h.compact(1)+b'\x40\x00'+h.compact(1)+h.compact(2)+h.compact(0)
  with self.assertRaises(ValueError):h.decode_availability(raw.hex(),[address])
  with self.assertRaises(ValueError):h.decode_availability(raw.hex(),['other'])
if __name__=='__main__':unittest.main()
