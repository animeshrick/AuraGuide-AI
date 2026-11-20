import { expect, test } from "@playwright/test";
import {
  createPlan,
  dictionaries,
  mockJson,
  mockPlan,
  sampleAdvisory,
  samplePlan,
  sampleWhatIf,
  switchLanguage,
} from "./helpers";

const en = dictionaries.en;
const hi = dictionaries.hi;

test.describe("keyboard", () => {
  test("the skip link is the first tab stop and moves focus to the main content", async ({
    page,
  }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: en.nav.skipToContent });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();

    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();
  });

  test("a person can reach the submit button and get a plan using only the keyboard", async ({
    page,
  }) => {
    await mockPlan(page);
    await page.goto("/");

    const submit = page.getByRole("button", { name: en.form.generatePlan });
    let reached = false;
    for (let i = 0; i < 150 && !reached; i++) {
      await page.keyboard.press("Tab");
      reached = await submit.evaluate((el) => el === document.activeElement);
    }
    expect(reached, "the submit button should be reachable with Tab").toBe(true);

    await page.keyboard.press("Enter");
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toContainText("New Delhi");
    // Focus moves to the new heading so a screen reader starts reading the results.
    await expect(heading).toBeFocused();
  });

  test("focused controls have a visible outline", async ({ page }) => {
    await page.goto("/");
    const submit = page.getByRole("button", { name: en.form.generatePlan });
    await submit.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(submit).toBeFocused();

    const outline = await submit.evaluate((el) => {
      const style = getComputedStyle(el);
      return { width: parseFloat(style.outlineWidth), style: style.outlineStyle };
    });
    expect(outline.style).not.toBe("none");
    expect(outline.width).toBeGreaterThan(0);
  });
});

test.describe("household form", () => {
  test("loads a sample household", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: en.form.demoKolkata }).click();
    await expect(page.getByLabel(en.form.city)).toHaveValue("Kolkata");
  });

  test("does not send a request without a city", async ({ page }) => {
    const requests = await mockPlan(page);
    await page.goto("/");
    await page.getByLabel(en.form.city).fill("");
    await page.getByRole("button", { name: en.form.generatePlan }).click();

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(en.hero.title);
    expect(requests).toHaveLength(0);
  });

  test("sends the household and shows the plan", async ({ page }) => {
    const requests = await mockPlan(page);
    await page.goto("/");
    await page.getByLabel(en.form.city).fill("Delhi");
    await createPlan(page);

    expect(requests).toHaveLength(1);
    expect(requests[0].city).toBe("Delhi");
    expect(requests[0].language).toBe("en");
    expect(Array.isArray(requests[0].members)).toBe(true);
  });
});

test.describe("results", () => {
  test("shows the sections of the plan", async ({ page }) => {
    await mockPlan(page);
    await page.goto("/");
    await createPlan(page);

    for (const heading of [
      en.results.hourlyTitle,
      en.metrics.safeWindows,
      en.sections.timeline,
      en.plants.title,
      en.outing.title,
      en.sections.whatIfTitle,
      en.sections.communityAdvisory,
    ]) {
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    }
  });

  test("lists all 24 hours in the data table", async ({ page }) => {
    await mockPlan(page);
    await page.goto("/");
    await createPlan(page);

    await page.getByText(en.results.showTable).click();
    const table = page.getByRole("table", { name: en.results.hourlyTitle });
    await expect(table.getByRole("row")).toHaveCount(25);
  });

  test("explains that the plan came from the built-in rules", async ({ page }) => {
    await mockPlan(page, { ...samplePlan, isFallback: true });
    await page.goto("/");
    await createPlan(page);
    await expect(page.getByText(en.banners.fallbackPlan)).toBeVisible();
  });

  test("warns when the air quality data is modelled", async ({ page }) => {
    await mockPlan(page, {
      ...samplePlan,
      airQuality: { ...samplePlan.airQuality, source: "modelled" },
    });
    await page.goto("/");
    await createPlan(page);
    await expect(page.getByText(en.banners.modelled)).toBeVisible();
  });

  test("goes back to the form with the same household", async ({ page }) => {
    await mockPlan(page);
    await page.goto("/");
    await createPlan(page);

    await page.getByRole("button", { name: en.nav.newProfile }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(en.hero.title);
    await expect(page.getByLabel(en.form.city)).toHaveValue("New Delhi");
  });
});

test.describe("language", () => {
  test("changes the page text and the html lang attribute", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");

    await switchLanguage(page, "en", "hi");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(hi.hero.title);

    await switchLanguage(page, "hi", "bn");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(dictionaries.bn.hero.title);
  });

  test("asks for the plan again in the new language", async ({ page }) => {
    const requests = await mockPlan(page);
    await page.goto("/");
    await createPlan(page);

    await switchLanguage(page, "en", "hi");
    await expect.poll(() => requests.length).toBe(2);
    expect(requests[1].language).toBe("hi");
  });

  test("tells Hindi readers when the plan text is written in English by the built-in rules", async ({
    page,
  }) => {
    await mockPlan(page, { ...samplePlan, isFallback: true });
    await page.goto("/");
    await switchLanguage(page, "en", "hi");
    await page.getByRole("button", { name: hi.form.generatePlan }).click();
    await expect(page.getByText(hi.banners.englishOnly)).toBeVisible();
  });

  test("keeps the chosen language when the page is reloaded", async ({ page }) => {
    await page.goto("/");
    await switchLanguage(page, "en", "hi");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "hi");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(hi.hero.title);
  });
});

test.describe("errors", () => {
  const cases = [
    ["city_not_found", 404, en.errors.city_not_found],
    ["rate_limited", 429, en.errors.rate_limited],
    ["internal_error", 500, en.errors.internal_error],
  ] as const;

  for (const [code, status, message] of cases) {
    test(`shows a clear message for ${code}`, async ({ page }) => {
      await mockPlan(page, { error: "x", code }, status);
      await page.goto("/");
      await page.getByRole("button", { name: en.form.generatePlan }).click();

      await expect(page.getByRole("alert")).toContainText(message);
      // The household is still on screen, so nothing the person typed is lost.
      await expect(page.getByLabel(en.form.city)).toHaveValue("New Delhi");
    });
  }

  test("shows a network message when the server is unreachable", async ({ page }) => {
    await page.route("**/api/plan", (route) => route.abort("failed"));
    await page.goto("/");
    await page.getByRole("button", { name: en.form.generatePlan }).click();
    await expect(page.getByRole("alert")).toContainText(en.errors.network);
  });
});

test.describe("what-if and community advisory", () => {
  test("answers a tapped travel option using the recalculated numbers", async ({ page }) => {
    await mockPlan(page);
    const requests = await mockJson(page, "**/api/whatif", sampleWhatIf);
    await page.goto("/");
    await createPlan(page);

    await page.getByRole("button", { name: en.whatIf.options.metro }).click();

    await expect(page.getByText(sampleWhatIf.explanation)).toBeVisible();
    await expect(page.getByRole("heading", { name: /A good change for Rajesh/ })).toBeVisible();
    expect(requests).toHaveLength(1);
    expect(requests[0].toMode).toBe("metro");
    expect(requests[0].memberId).toBe("m1");
    expect(requests[0].language).toBe("en");
  });

  test("writes an advisory and copies it", async ({ page, context, browserName }) => {
    test.skip(browserName !== "chromium", "Clipboard permissions are set for Chromium only.");
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await mockPlan(page);
    await mockJson(page, "**/api/advisory", sampleAdvisory);
    await page.goto("/");
    await createPlan(page);

    await page
      .getByRole("radio", { name: en.advisory.audiences.school, includeHidden: true })
      .check({ force: true });
    await page.getByRole("button", { name: en.advisory.generate }).click();
    await expect(page.getByText(sampleAdvisory.advisoryText)).toBeVisible();

    await page.getByRole("button", { name: en.advisory.copy }).click();
    await expect(page.getByRole("button", { name: en.advisory.copied })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      sampleAdvisory.advisoryText
    );

    const share = page.getByRole("link", { name: en.advisory.shareWhatsApp });
    await expect(share).toHaveAttribute("rel", "noopener noreferrer");
    await expect(share).toHaveAttribute("href", /^https:\/\/wa\.me\/\?text=/);
  });
});
