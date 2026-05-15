import { describe, expect, it } from "vitest";

import { stratifyByQuartile } from "../stratify.js";

interface TestEvent {
  id: string;
  score: number;
}

function makeEvents(scores: number[]): TestEvent[] {
  return scores.map((s, i) => ({ id: `e${i}`, score: s }));
}

const getScore = (e: TestEvent) => e.score;

describe("stratifyByQuartile", () => {
  it("throws when given fewer than 20 events", () => {
    const tooFew = makeEvents(Array.from({ length: 19 }, (_, i) => i));
    expect(() => stratifyByQuartile(tooFew, getScore)).toThrow(
      /at least 20 events.*got 19/i,
    );
  });

  it("returns exactly 20 events from a 20-event population (one per rank slot)", () => {
    const exactly20 = makeEvents(Array.from({ length: 20 }, (_, i) => i));
    const result = stratifyByQuartile(exactly20, getScore);
    expect(result).toHaveLength(20);
    const ids = new Set(result.map((e) => e.id));
    expect(ids.size).toBe(20);
  });

  it("returns 20 events from a 100-event population, 5 per quartile near the median rank", () => {
    const hundred = makeEvents(Array.from({ length: 100 }, (_, i) => i));
    const result = stratifyByQuartile(hundred, getScore);
    expect(result).toHaveLength(20);
    const sortedScores = result.map((e) => e.score).sort((a, b) => a - b);
    // Quartile 0 (ranks 0-24): expect picks near rank 12 -> scores around 10-14
    expect(sortedScores.slice(0, 5).every((s) => s >= 8 && s <= 16)).toBe(true);
    // Quartile 3 (ranks 75-99): expect picks near rank 87 -> scores around 85-89
    expect(sortedScores.slice(15, 20).every((s) => s >= 83 && s <= 91)).toBe(
      true,
    );
  });

  it("covers all four quartiles (lowest pick < highest pick by a wide margin)", () => {
    const hundred = makeEvents(Array.from({ length: 100 }, (_, i) => i));
    const result = stratifyByQuartile(hundred, getScore);
    const scores = result.map((e) => e.score);
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    expect(max - min).toBeGreaterThanOrEqual(60);
  });

  it("is deterministic: same input -> same output (order-independent)", () => {
    const fifty = makeEvents(Array.from({ length: 50 }, (_, i) => i));
    const a = stratifyByQuartile(fifty, getScore);
    const b = stratifyByQuartile([...fifty].reverse(), getScore);
    const aIds = a.map((e) => e.id).sort();
    const bIds = b.map((e) => e.id).sort();
    expect(aIds).toEqual(bIds);
  });

  it("handles tied scores without throwing", () => {
    const allFives = makeEvents(Array.from({ length: 25 }, () => 5));
    const result = stratifyByQuartile(allFives, getScore);
    expect(result).toHaveLength(20);
  });
});
