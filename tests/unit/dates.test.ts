import { formatDayLabel } from "@/lib/dates";

describe("formatDayLabel", () => {
  it("names the weekday and date in the page language", () => {
    expect(formatDayLabel("2026-11-23", "en")).toMatch(/Monday/);
    expect(formatDayLabel("2026-11-23", "en")).toMatch(/23/);
    expect(formatDayLabel("2026-11-23", "hi")).toMatch(/सोमवार/);
    expect(formatDayLabel("2026-11-23", "bn")).toMatch(/সোমবার/);
  });

  it("returns the input when it is not a date", () => {
    expect(formatDayLabel("soon", "en")).toBe("soon");
  });
});
