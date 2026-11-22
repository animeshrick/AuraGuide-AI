import { formatDose, formatKg, localClock } from "@/lib/format";

describe("formatKg", () => {
  it("keeps at most two decimals and drops trailing zeros", () => {
    expect(formatKg(2.345)).toBe("2.35");
    expect(formatKg(4)).toBe("4");
  });

  it("shows 0 for values that are not finite", () => {
    expect(formatKg(Number.NaN)).toBe("0");
    expect(formatKg(Number.POSITIVE_INFINITY)).toBe("0");
  });
});

describe("formatDose", () => {
  it("uses whole numbers from 10 up and one decimal below", () => {
    expect(formatDose(12.6)).toBe("13");
    expect(formatDose(3.46)).toBe("3.5");
  });

  it("shows 0 for values that are not finite", () => {
    expect(formatDose(Number.NaN)).toBe("0");
  });
});

describe("localClock", () => {
  it("reads the clock part of a local ISO time", () => {
    expect(localClock("2026-11-19T18:00")).toBe("18:00");
  });

  it("returns an empty string for a missing or odd value", () => {
    expect(localClock(undefined)).toBe("");
    expect(localClock("yesterday")).toBe("");
  });
});
