import { expect, test } from "@playwright/test";
import { createPlan, mockPlan, samplePlan } from "./helpers";

test.describe("security headers", () => {
  test("the page is served with the expected headers", async ({ page }) => {
    const response = await page.goto("/");
    const headers = response?.headers() ?? {};

    expect(headers["content-security-policy"]).toContain("default-src 'self'");
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["content-security-policy"]).toContain("object-src 'none'");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"]).toContain("geolocation=()");
    expect(headers["x-powered-by"]).toBeUndefined();
  });

  test("the page loads without content security policy violations", async ({ page }) => {
    const violations: string[] = [];
    page.on("console", (message) => {
      if (/content security policy/i.test(message.text())) violations.push(message.text());
    });
    await mockPlan(page);
    await page.goto("/");
    await createPlan(page);
    expect(violations).toEqual([]);
  });
});

test.describe("API input handling", () => {
  test("rejects a household that is not valid", async ({ request }) => {
    const response = await request.post("/api/plan", { data: { city: "", members: [] } });
    expect(response.status()).toBe(400);
    expect((await response.json()).code).toBe("invalid_request");
  });

  test("rejects a body that is not JSON", async ({ request }) => {
    const response = await request.post("/api/plan", {
      headers: { "content-type": "application/json" },
      data: "{not json",
    });
    expect(response.status()).toBe(400);
    expect((await response.json()).code).toBe("invalid_json");
  });

  test("rejects other methods", async ({ request }) => {
    const response = await request.get("/api/plan");
    expect(response.status()).toBe(405);
  });

  test("rejects an advisory request for an unknown audience", async ({ request }) => {
    const response = await request.post("/api/advisory", {
      data: { city: "Delhi", audience: "everyone", language: "en" },
    });
    expect(response.status()).toBe(400);
  });
});

test.describe("model output is never treated as markup", () => {
  test("text with HTML in it is shown as text", async ({ page }) => {
    const attack = '<img src=x onerror="window.__pwned=1"><script>window.__pwned=1</script>';
    await mockPlan(page, { ...samplePlan, summary: attack, communityTip: attack });
    await page.goto("/");
    await createPlan(page);

    await expect(page.getByText("<img src=x", { exact: false }).first()).toBeVisible();
    await expect(page.locator("main img")).toHaveCount(0);
    expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBe(
      undefined
    );
  });
});
