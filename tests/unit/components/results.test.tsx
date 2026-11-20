// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { generateFallbackPlan } from "@/domain/rules-fallback";
import type { DailyPlanResponse } from "@/domain/types";
import { getDictionary, type SupportedLanguage } from "@/i18n";
import { BeforeAfterTimeline } from "@/components/BeforeAfterTimeline";
import { HourlyAQIChart } from "@/components/HourlyAQIChart";
import { PlanResults } from "@/components/PlanResults";
import { SafeWindowTimeline } from "@/components/SafeWindowTimeline";
import { accessibilityProblems } from "../helpers/axe";
import { makeAirQuality, makeHourly, makeProfile } from "../helpers/fixtures";

afterEach(cleanup);

const profile = makeProfile();
const airQuality = makeAirQuality();

function makePlan(overrides: Partial<DailyPlanResponse> = {}): DailyPlanResponse {
  return { ...generateFallbackPlan(profile, airQuality), ...overrides };
}

function renderResults(
  plan: DailyPlanResponse,
  language: SupportedLanguage = "en",
  isUpdating = false
) {
  return render(
    <PlanResults
      plan={plan}
      profile={profile}
      language={language}
      dict={getDictionary(language)}
      isUpdating={isUpdating}
      headingRef={React.createRef<HTMLHeadingElement>()}
    />
  );
}

describe("HourlyAQIChart", () => {
  const dict = getDictionary("en");

  it("lists every hour as text and in a table", () => {
    const hourly = makeHourly(6, 24);
    render(<HourlyAQIChart hourly={hourly} dict={dict} />);

    const table = screen.getByRole("table", { name: dict.results.hourlyTitle });
    // One header row plus 24 data rows.
    expect(within(table).getAllByRole("row")).toHaveLength(25);
    for (const h of hourly.slice(0, 3)) {
      expect(within(table).getAllByText(dict.categories[h.category]).length).toBeGreaterThan(0);
    }
  });

  it("describes each bar in words, so colour is never the only signal", () => {
    const hourly = makeHourly(6, 24);
    const { container } = render(<HourlyAQIChart hourly={hourly} dict={dict} />);
    const items = container.querySelectorAll("ol > li");
    expect(items).toHaveLength(24);
    const first = hourly[0];
    expect(items[0].textContent).toContain(`${dict.metrics.aqiLabel} ${first.aqi}`);
    expect(items[0].textContent).toContain(dict.categories[first.category]);
  });

  it("keeps each bar's hidden text inside the bar, so the chart scrolls and the page does not", () => {
    // Absolutely positioned screen-reader text escapes a scrolling box unless its parent is
    // positioned. Without this the whole page scrolls sideways on a phone.
    const { container } = render(<HourlyAQIChart hourly={makeHourly()} dict={dict} />);
    for (const item of container.querySelectorAll("ol > li")) {
      expect(item.className.split(" ")).toContain("relative");
    }
  });

  it("keeps the scroll area reachable by keyboard", () => {
    render(<HourlyAQIChart hourly={makeHourly()} dict={dict} />);
    const region = screen.getByRole("region", { name: dict.results.hourlyScrollLabel });
    expect(region.getAttribute("tabindex")).toBe("0");
  });

  it("renders nothing when there is no data", () => {
    const { container } = render(<HourlyAQIChart hourly={[]} dict={dict} />);
    expect(container.innerHTML).toBe("");
  });

  it("only shows the first 24 hours", () => {
    render(<HourlyAQIChart hourly={makeHourly(0, 40)} dict={dict} />);
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(25);
  });
});

describe("SafeWindowTimeline", () => {
  const dict = getDictionary("en");

  it("shows each window with its time range and AQI text", () => {
    const plan = makePlan();
    expect(plan.safeWindows.length).toBeGreaterThan(0);
    render(<SafeWindowTimeline safeWindows={plan.safeWindows} dict={dict} />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(plan.safeWindows.length);
    expect(items[0].textContent).toContain(dict.metrics.aqiLabel);
  });

  it("says so when there is no safe window", () => {
    render(<SafeWindowTimeline safeWindows={[]} dict={dict} />);
    expect(screen.getByText(dict.results.noSafeWindows)).toBeTruthy();
    expect(screen.queryByRole("list")).toBeNull();
  });
});

describe("BeforeAfterTimeline", () => {
  const dict = getDictionary("en");

  it("labels the normal and the optimized day in words for every hour", () => {
    const plan = makePlan();
    render(<BeforeAfterTimeline schedule={plan.schedule} dict={dict} />);
    const items = screen.getAllByRole("listitem");
    expect(items.length).toBeGreaterThanOrEqual(plan.schedule.length);
    expect(screen.getAllByText(dict.results.colNormal)).toHaveLength(plan.schedule.length);
    expect(screen.getAllByText(dict.results.colOptimized)).toHaveLength(plan.schedule.length);
  });

  it("renders nothing for an empty schedule", () => {
    const { container } = render(<BeforeAfterTimeline schedule={[]} dict={dict} />);
    expect(container.innerHTML).toBe("");
  });
});

describe("PlanResults", () => {
  it("shows the city in the main heading", () => {
    renderResults(makePlan());
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("New Delhi");
  });

  it("puts the heading ref on the h1, so the page can move focus there", () => {
    const ref = React.createRef<HTMLHeadingElement>();
    const dict = getDictionary("en");
    render(
      <PlanResults
        plan={makePlan()}
        profile={profile}
        language="en"
        dict={dict}
        isUpdating={false}
        headingRef={ref}
      />
    );
    expect(ref.current).toBe(screen.getByRole("heading", { level: 1 }));
    expect(ref.current?.getAttribute("tabindex")).toBe("-1");
  });

  it("explains that the plan came from the built-in rules", () => {
    renderResults(makePlan({ isFallback: true }));
    expect(screen.getByText(getDictionary("en").banners.fallbackPlan)).toBeTruthy();
    expect(screen.queryByText(getDictionary("en").banners.englishOnly)).toBeNull();
  });

  it("does not show the fallback banner for a model plan", () => {
    renderResults(makePlan({ isFallback: false }));
    expect(screen.queryByText(getDictionary("en").banners.fallbackPlan)).toBeNull();
  });

  it("warns when the air quality numbers are modelled rather than live", () => {
    const plan = makePlan();
    renderResults({ ...plan, airQuality: { ...plan.airQuality, source: "modelled" } });
    expect(screen.getByText(getDictionary("en").banners.modelled)).toBeTruthy();
  });

  it("tells Hindi readers that fallback text is in English", () => {
    renderResults(makePlan({ isFallback: true }), "hi");
    const dict = getDictionary("hi");
    expect(screen.getByText(dict.banners.fallbackPlan)).toBeTruthy();
    expect(screen.getByText(dict.banners.englishOnly)).toBeTruthy();
  });

  it("shows the updating banner while the language changes", () => {
    renderResults(makePlan({ isFallback: false }), "bn", true);
    expect(screen.getByText(getDictionary("bn").banners.updatingLanguage)).toBeTruthy();
  });

  it("renders model text as plain text, never as markup", () => {
    const attack = '<img src=x onerror="window.__pwned=1"><script>window.__pwned=1</script>';
    const { container } = renderResults(makePlan({ summary: attack, communityTip: attack }));
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain("<img src=x");
    expect((window as unknown as { __pwned?: number }).__pwned).toBeUndefined();
  });

  it("has a single h1 and no skipped heading levels", () => {
    const { container } = renderResults(makePlan());
    expect(container.querySelectorAll("h1")).toHaveLength(1);
    const levels = Array.from(container.querySelectorAll("h1,h2,h3,h4")).map((h) =>
      Number(h.tagName[1])
    );
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1);
    }
  });

  it.each<SupportedLanguage>(["en", "hi", "bn"])(
    "has no accessibility violations in %s",
    async (language) => {
      const { container } = renderResults(makePlan(), language);
      expect(await accessibilityProblems(container)).toEqual([]);
    }
  );
});
