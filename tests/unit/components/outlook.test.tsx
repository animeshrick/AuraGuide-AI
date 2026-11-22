// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { OutlookPanel } from "@/components/OutlookPanel";
import { PlanResults } from "@/components/PlanResults";
import type { DayOutlook } from "@/domain/types";
import { getDictionary } from "@/i18n";
import { accessibilityProblems } from "../helpers/axe";
import { makeAirQuality, makeHourly, makeProfile } from "../helpers/fixtures";
import { makePlan } from "../helpers/plan";

afterEach(cleanup);

const dict = getDictionary("en");

const days: DayOutlook[] = [
  {
    date: "2026-11-20",
    averageAQI: 230,
    category: "Poor",
    peakAQI: 310,
    level: "avoid",
    bestWindow: { startHour: 14, endHour: 16, averageAQI: 180 },
    isBestDay: false,
  },
  {
    date: "2026-11-21",
    averageAQI: 85,
    category: "Satisfactory",
    peakAQI: 120,
    level: "good",
    bestWindow: { startHour: 13, endHour: 15, averageAQI: 60 },
    isBestDay: true,
  },
  {
    date: "2026-11-22",
    averageAQI: 150,
    category: "Moderate",
    peakAQI: 190,
    level: "careful",
    bestWindow: { startHour: 12, endHour: 14, averageAQI: 120 },
    isBestDay: false,
  },
];

describe("OutlookPanel", () => {
  it("shows one card per day with its verdict and cleanest time", () => {
    render(<OutlookPanel outlook={days} language="en" dict={dict} />);
    const cards = screen.getAllByRole("listitem");
    expect(cards).toHaveLength(3);
    expect(within(cards[0]).getByRole("heading", { level: 3 }).textContent).toMatch(/Friday/);
    expect(within(cards[0]).getByText(dict.outlook.levels.avoid)).toBeTruthy();
    expect(within(cards[0]).getByText("Cleanest time to go out: 14:00 - 16:00")).toBeTruthy();
    expect(within(cards[2]).getByText("Worst hour of the day: AQI 190")).toBeTruthy();
  });

  it("marks only the best day", () => {
    render(<OutlookPanel outlook={days} language="en" dict={dict} />);
    const badges = screen.getAllByText(dict.outlook.bestDay);
    expect(badges).toHaveLength(1);
    expect(screen.getAllByRole("listitem")[1].contains(badges[0])).toBe(true);
  });

  it("says so when there is no forecast for the coming days", () => {
    render(<OutlookPanel outlook={[]} language="en" dict={dict} />);
    expect(screen.getByText(dict.outlook.unavailable)).toBeTruthy();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("writes day names and text in Hindi", () => {
    const hi = getDictionary("hi");
    render(<OutlookPanel outlook={days} language="hi" dict={hi} />);
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(hi.outlook.title);
    expect(screen.getAllByRole("heading", { level: 3 })[0].textContent).toMatch(/शुक्रवार/);
  });

  it("has no accessibility problems", async () => {
    const { container } = render(<OutlookPanel outlook={days} language="en" dict={dict} />);
    expect(await accessibilityProblems(container)).toEqual([]);
  });

  it("appears in a plan built from a multi-day forecast", () => {
    const airQuality = makeAirQuality({ forecastHours: makeHourly(6, 90) });
    const plan = makePlan(makeProfile(), airQuality);
    expect(plan.outlook.length).toBeGreaterThan(0);
    render(
      <PlanResults
        plan={plan}
        profile={makeProfile()}
        language="en"
        dict={dict}
        isUpdating={false}
        headingRef={React.createRef()}
      />
    );
    expect(screen.getByRole("heading", { name: dict.outlook.title })).toBeTruthy();
  });
});
