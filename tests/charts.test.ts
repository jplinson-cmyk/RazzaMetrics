import { describe, expect, it } from "vitest";
import { curve } from "../src/components/explorer/charts";
import { monthRange, monthsIn } from "../src/components/explorer/MonthFilter";

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

describe("month filter", () => {
  it("covers a whole past month, including February in a leap year", () => {
    expect(monthRange("2024-02")).toEqual({ start: "2024-02-01", end: "2024-02-29" });
  });
  it("stops the current month at today", () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(monthRange(today.slice(0, 7)).end).toBe(today);
  });
  it("lists each month once, newest first, skipping missing dates", () => {
    expect(monthsIn(["2026-10-03", undefined, "2026-11-01", "2026-10-30"])).toEqual(["2026-11", "2026-10"]);
  });
});
