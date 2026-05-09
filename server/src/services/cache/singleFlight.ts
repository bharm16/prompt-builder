/**
 * Generic single-flight (a.k.a. Promise coalescing) primitive.
 *
 * When N concurrent callers ask for the same key, `compute` runs exactly once
 * and every caller awaits the same promise. The first caller is the
 * "computed" source; subsequent callers in the same flight are "coalesced".
 *
 * Used by both `CacheService.getOrCompute` and
 * `SpanLabelingCacheService.getOrCompute` so they share one well-tested
 * implementation rather than diverging copies.
 */
export type SingleFlightSource = "computed" | "coalesced";

export async function runSingleFlight<T>(
  inflight: Map<string, Promise<unknown>>,
  key: string,
  compute: () => Promise<T>,
): Promise<{ value: T; source: SingleFlightSource }> {
  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) {
    const value = await existing;
    return { value, source: "coalesced" };
  }

  const promise = compute();
  inflight.set(key, promise as Promise<unknown>);
  try {
    const value = await promise;
    return { value, source: "computed" };
  } finally {
    inflight.delete(key);
  }
}
