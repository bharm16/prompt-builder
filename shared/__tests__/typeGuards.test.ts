import { describe, it, expect } from "vitest";
import { isRecord } from "../utils/typeGuards";

describe("isRecord", () => {
  describe("matches", () => {
    it("returns true for plain objects", () => {
      expect(isRecord({})).toBe(true);
      expect(isRecord({ a: 1 })).toBe(true);
      expect(isRecord(Object.create(null))).toBe(true);
    });

    it("returns true for class instances", () => {
      class Thing {
        x = 1;
      }
      expect(isRecord(new Thing())).toBe(true);
    });
  });

  describe("non-matches", () => {
    it("returns false for arrays", () => {
      // This is the explicit array-rejection contract — locks it in for future readers.
      expect(isRecord([])).toBe(false);
      expect(isRecord([1, 2, 3])).toBe(false);
      expect(isRecord(new Array(3))).toBe(false);
    });

    it("returns false for null", () => {
      expect(isRecord(null)).toBe(false);
    });

    it("returns false for primitives", () => {
      expect(isRecord(undefined)).toBe(false);
      expect(isRecord("string")).toBe(false);
      expect(isRecord("")).toBe(false);
      expect(isRecord(42)).toBe(false);
      expect(isRecord(0)).toBe(false);
      expect(isRecord(true)).toBe(false);
      expect(isRecord(false)).toBe(false);
      expect(isRecord(Symbol("x"))).toBe(false);
    });

    it("returns false for functions", () => {
      // Functions have typeof 'function', not 'object'.
      expect(isRecord(() => null)).toBe(false);
      expect(isRecord(function named() {})).toBe(false);
    });
  });

  describe("type narrowing", () => {
    it("narrows unknown to UnknownRecord at runtime", () => {
      const value: unknown = { foo: "bar", count: 3 };
      if (!isRecord(value)) {
        throw new Error("expected isRecord to narrow");
      }
      // After narrowing, property access is type-checked as `unknown`.
      expect(typeof value.foo).toBe("string");
      expect(typeof value.count).toBe("number");
      expect(value.missing).toBeUndefined();
    });
  });
});
