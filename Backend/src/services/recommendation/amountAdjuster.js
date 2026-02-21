export function getAmountPenalty(amount) {
  if (amount >= 500000) return 0.4;
  if (amount >= 200000) return 0.2;
  return 0;
}