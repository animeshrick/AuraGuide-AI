import { bySign } from "@/lib/by-sign";

describe("bySign", () => {
  const choices = { positive: "up", negative: "down", zero: "flat" };

  it.each([
    [3, "up"],
    [-0.5, "down"],
    [0, "flat"],
  ])("picks the choice for %s", (value, expected) => {
    expect(bySign(value, choices)).toBe(expected);
  });
});
