import { describe, expect, it } from "vitest";
import { curve } from "../src/components/explorer/charts";

describe("curve", () => {
  it("never bends past the data, so a smoothed line cannot dip below zero or above a peak", () => {
    const pts: [number, number][] = [[0, 100], [10, 0], [20, 0], [30, 100], [40, 90], [50, 100]];
    const ys = curve(pts).match(/-?\d+(\.\d+)?/g)!.map(Number).filter((_, i) => i % 2 === 1);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...ys)).toBeLessThanOrEqual(100);
  });
  it("draws straight segments for one or two points", () => {
    expect(curve([[0, 5], [10, 6]])).toBe("M0.0 5.0 L10.0 6.0");
  });
});
