import fs from "node:fs";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import bn from "../../src/i18n/bn.json";
import en from "../../src/i18n/en.json";
import hi from "../../src/i18n/hi.json";

export const dictionaries = { en, hi, bn } as const;
export type Lang = keyof typeof dictionaries;

/** A fixed plan for New Delhi, built by the app's own rules engine. The e2e tests never call Gemini or Open-Meteo. */
export const samplePlan = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "tests/e2e/fixtures/plan.json"), "utf8")
);

export const sampleWhatIf = {
  matched: true,
  question: "What if Rajesh took the metro?",
  currentAQI: 377,
  memberId: "m1",
  memberName: "Rajesh",
  fromMode: "car_ice",
  toMode: "metro",
  householdBaselineEmissionsKg: 5.2,
  householdRecalculatedEmissionsKg: 3.1,
  savedEmissionsKg: 2.1,
  baselineExposureDose: 10,
  recalculatedExposureDose: 8,
  exposureChangePercentage: -20,
  explanation: "Taking the metro removes tailpipe emissions for this trip.",
  explanationSource: "rules",
};

export const sampleAdvisory = {
  city: "New Delhi",
  currentAQI: 377,
  category: "severe",
  audience: "housing_society",
  dataSource: "open-meteo",
  advisoryText:
    "Notice to residents: air quality is severe today. Please keep windows closed and avoid outdoor play.",
  advisorySource: "rules",
};

/** Answer /api/plan with a fixed body. Returns the list of request bodies the page sent. */
export async function mockPlan(page: Page, body: unknown = samplePlan, status = 200) {
  const requests: Array<Record<string, unknown>> = [];
  await page.route("**/api/plan", async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  return requests;
}

export async function mockJson(page: Page, pattern: string, body: unknown, status = 200) {
  const requests: Array<Record<string, unknown>> = [];
  await page.route(pattern, async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  });
  return requests;
}

export async function switchLanguage(page: Page, from: Lang, to: Lang) {
  if (from === to) return;
  const label =
    to === "en"
      ? dictionaries[from].nav.switchToEnglish
      : to === "hi"
        ? dictionaries[from].nav.switchToHindi
        : dictionaries[from].nav.switchToBengali;
  await page.getByRole("button", { name: label }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", to);
}

export async function createPlan(page: Page, lang: Lang = "en") {
  await page.getByRole("button", { name: dictionaries[lang].form.generatePlan }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("New Delhi");
}

/** Fails with a readable list of problems. Colour contrast is checked here because a real browser has real styles. */
export async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const problems = results.violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.help}\n    ${v.nodes.map((n) => n.target.join(" ")).join("\n    ")}`
  );
  expect(problems, problems.join("\n")).toEqual([]);
}

/**
 * A visible banner that contains some text. Next.js adds its own empty role="alert" element for
 * route changes, so a bare getByRole("alert") matches two elements. Matching on text picks ours.
 */
export function alertWith(page: Page, text: string) {
  return page.getByRole("alert").filter({ hasText: text });
}
