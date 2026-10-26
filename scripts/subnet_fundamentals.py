"""Same-block owner emission rates for the daily holdings snapshot (no visitor RPC)."""
U64_MAX = 2**64 - 1
BLOCKS_PER_DAY = 7200  # Explicit estimate: 12-second blocks, not actual 24h earnings.


def owner_daily_rate(emission, weights):
    values = [int(v) for v in weights]
    if len(values) != 5 or any(v < 0 for v in values) or sum(values) != U64_MAX:
        raise ValueError('Invalid normalized emission weights')
    if emission < 0:
        raise ValueError('Invalid alpha emission')
    # Runtime accrues a floored native-unit cut each block.
    return (int(emission) * values[2] // U64_MAX) * BLOCKS_PER_DAY


def add_owner_emissions(chain, block_hash, rows):
    emissions = {int(k.value): int(v.value) for k, v in chain.query_map(
        'SubtensorModule', 'SubnetAlphaOutEmission', block_hash=block_hash)}
    keys = [chain.create_storage_key('SubtensorModule', 'SubnetEmissionWeights', [int(sn)]) for sn in rows]
    values = chain.query_multi(keys, block_hash=block_hash)
    if len(values) != len(keys):
        raise ValueError('Incomplete emission weights')
    evidence = {}
    for sn, (_, value) in zip(rows, values):
        emission = emissions.get(int(sn))
        if emission is None:
            # Unstarted registrations can omit this Default storage map key.
            # Read the same-block runtime default explicitly, never invent zero.
            emission = chain.query('SubtensorModule', 'SubnetAlphaOutEmission',
                                   [int(sn)], block_hash=block_hash).value
            if emission is None:
                raise ValueError('Missing alpha emission')
            emission = int(emission)
        weights = [int(v) for v in value.value]
        amount = owner_daily_rate(emission, weights)
        rows[sn].update(ownerEmissionPerDayRaw=str(amount), alphaOutEmissionRaw=str(emission), ownerWeightRaw=str(weights[2]))
        evidence[sn] = {'alphaOutEmissionRaw': str(emission), 'weights': [str(v) for v in weights], 'blocksPerDay': BLOCKS_PER_DAY}
    return evidence
