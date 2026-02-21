export function getDurationMultiplier(months) {
  if (months <= 12) return 0.8;     // short-term → less risk
  if (months <= 36) return 1.0;     // neutral
  return 1.2;                      // long-term → slightly more risk
}