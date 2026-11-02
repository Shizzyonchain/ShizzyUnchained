/** Pure price arithmetic. Inputs share a quote currency; no return or timing forecast. */
export function recoveryMath(reference: number, current: number) {
  if (!Number.isFinite(reference) || !Number.isFinite(current) || reference <= 0 || current < 0 || current > reference) return null;
  if (current > 0 && !Number.isFinite((reference / current - 1) * 100)) return null;
  const drop = (1 - current / reference) * 100;
  return { drop, requiredGain: current === 0 ? null : (reference / current - 1) * 100, gap: reference - current };
}
