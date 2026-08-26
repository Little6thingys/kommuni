/** Warm-up then average wall time so synthetic latency asserts stay stable. */
export function averageRuntimeMs(fn: () => void, iterations = 25): number {
  fn();
  const startedAt = performance.now();
  for (let i = 0; i < iterations; i += 1) {
    fn();
  }
  return (performance.now() - startedAt) / iterations;
}
