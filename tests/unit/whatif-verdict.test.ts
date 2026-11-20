import { barWidths, whatIfVerdict } from "@/lib/whatif-verdict";

describe("whatIfVerdict", () => {
  it.each([
    [-20, 2.1, "better"],
    [-5, 0, "better"],
    [0, 1.2, "better"],
    [10, 2.1, "mixed"],
    [-10, -2.1, "mixed"],
    [0, 0, "same"],
    [12, 0, "worse"],
    [0, -1.5, "worse"],
    [12, -1.5, "worse"],
  ])("air %s%% and fumes saved %s kg is %s", (air, saved, expected) => {
    expect(whatIfVerdict(air, saved)).toBe(expected);
  });

  it("treats changes too small to show on screen as no change", () => {
    expect(whatIfVerdict(0.4, 0.004)).toBe("same");
    expect(whatIfVerdict(-0.4, -0.004)).toBe("same");
  });
});

describe("barWidths", () => {
  it("scales both bars to the longer one", () => {
    expect(barWidths(100, 80)).toEqual({ now: 100, after: 80 });
    expect(barWidths(4, 8)).toEqual({ now: 50, after: 100 });
  });

  it("never goes below zero or above one hundred", () => {
    expect(barWidths(5, -3)).toEqual({ now: 100, after: 0 });
    expect(barWidths(100, 250)).toEqual({ now: 40, after: 100 });
  });

  it("draws empty bars when both values are zero", () => {
    expect(barWidths(0, 0)).toEqual({ now: 0, after: 0 });
  });
});
