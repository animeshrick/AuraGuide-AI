import { expect, test } from "@playwright/test";
import {
  createPlan,
  dictionaries,
  expectNoAxeViolations,
  type Lang,
  mockJson,
  mockPlan,
  sampleAdvisory,
  sampleWhatIf,
  switchLanguage,
} from "./helpers";

const LANGUAGES: Lang[] = ["en", "hi", "bn"];

test.describe("accessibility: landing page", () => {
  for (const lang of LANGUAGES) {
    test(`has no axe violations in ${lang}`, async ({ page }) => {
      await page.goto("/");
      await switchLanguage(page, "en", lang);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        dictionaries[lang].hero.title
      );
      await expectNoAxeViolations(page);
    });
  }

  test("has one h1, a main landmark and a skip link", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.getByRole("main")).toHaveCount(1);
    await expect(
      page.getByRole("link", { name: dictionaries.en.nav.skipToContent })
    ).toHaveAttribute("href", "#main-content");
  });
});

test.describe("accessibility: results", () => {
  for (const lang of LANGUAGES) {
    test(`has no axe violations in ${lang}`, async ({ page }) => {
      await mockPlan(page);
      await page.goto("/");
      await switchLanguage(page, "en", lang);
      await page.getByRole("button", { name: dictionaries[lang].form.generatePlan }).click();
      await expect(page.getByRole("heading", { level: 1 })).toContainText("New Delhi");
      await expectNoAxeViolations(page);
    });
  }

  test("has no axe violations with the data table, what-if answer and advisory open", async ({
    page,
  }) => {
    await mockPlan(page);
    await mockJson(page, "**/api/whatif", sampleWhatIf);
    await mockJson(page, "**/api/advisory", sampleAdvisory);
    await page.goto("/");
    await createPlan(page);

    await page.getByText(dictionaries.en.results.showTable).click();
    await page.getByRole("button", { name: dictionaries.en.whatIf.options.metro }).click();
    await expect(page.getByText(sampleWhatIf.explanation)).toBeVisible();
    await page.getByRole("button", { name: dictionaries.en.advisory.generate }).click();
    await expect(page.getByText(sampleAdvisory.advisoryText)).toBeVisible();

    await expectNoAxeViolations(page);
  });

  test("shows the AQI as text next to every colour", async ({ page }) => {
    await mockPlan(page);
    await page.goto("/");
    await createPlan(page);

    // Every hour in the chart is described in words for screen readers.
    const hours = page
      .locator("section", { hasText: dictionaries.en.results.hourlyTitle })
      .locator("ol > li");
    await expect(hours).toHaveCount(24);
    await expect(hours.first()).toContainText(dictionaries.en.metrics.aqiLabel);
  });
});

test.describe("accessibility: small screens", () => {
  test.use({ viewport: { width: 375, height: 800 } });

  test("the page does not scroll sideways on a phone", async ({ page }) => {
    await mockPlan(page);
    await page.goto("/");
    const overflow = () =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );

    expect(await overflow()).toBeLessThanOrEqual(0);
    await createPlan(page);
    expect(await overflow()).toBeLessThanOrEqual(0);
  });

  test("has no axe violations on the results page", async ({ page }) => {
    await mockPlan(page);
    await page.goto("/");
    await createPlan(page);
    await expectNoAxeViolations(page);
  });
});
