// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HomePage from "@/app/page";
import { generateFallbackPlan } from "@/domain/rules-fallback";
import type { DailyPlanResponse } from "@/domain/types";
import { getDictionary } from "@/i18n";
import { accessibilityProblems } from "../helpers/axe";
import { makeAirQuality, makeProfile } from "../helpers/fixtures";

const en = getDictionary("en");
const hi = getDictionary("hi");
const bn = getDictionary("bn");

const fetchMock = vi.fn();

function reply(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function planFor(city: string): DailyPlanResponse {
  return generateFallbackPlan(makeProfile({ city }), makeAirQuality({ city }));
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function bodyOfCall(index: number) {
  const [, init] = fetchMock.mock.calls[index];
  return JSON.parse((init as RequestInit).body as string);
}

const createPlanButton = (name: RegExp | string = en.form.generatePlan) =>
  screen.getByRole("button", { name });
const cityField = (label = en.form.city) => screen.getByLabelText(label) as HTMLInputElement;

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  sessionStorage.clear();
  document.documentElement.lang = "";
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("HomePage", () => {
  it("starts with an introduction and the household form", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(en.hero.title);
    expect(cityField().value).toBe("New Delhi");
    expect(document.documentElement.lang).toBe("en");
    expect(screen.queryByRole("button", { name: en.nav.newProfile })).toBeNull();
  });

  it("requests a plan and moves focus to the results heading", async () => {
    fetchMock.mockResolvedValue(reply(planFor("New Delhi")));
    const user = userEvent.setup();
    render(<HomePage />);

    await user.click(createPlanButton());

    const heading = await screen.findByRole("heading", { level: 1, name: /New Delhi/ });
    await waitFor(() => expect(document.activeElement).toBe(heading));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/plan");
    expect(bodyOfCall(0).city).toBe("New Delhi");
    expect(bodyOfCall(0).language).toBe("en");
    expect(window.scrollTo).toHaveBeenCalled();
  });

  it("tells screen readers that the plan is loading", async () => {
    const pending = deferred<ReturnType<typeof reply>>();
    fetchMock.mockReturnValue(pending.promise);
    const user = userEvent.setup();
    render(<HomePage />);

    await user.click(createPlanButton());

    expect(
      (await screen.findAllByRole("status")).some((s) => s.textContent === en.a11y.loading)
    ).toBe(true);
    pending.resolve(reply(planFor("New Delhi")));
    await screen.findByRole("heading", { level: 1, name: /New Delhi/ });
  });

  it("switches language on the form without calling the server", async () => {
    const user = userEvent.setup();
    render(<HomePage />);

    await user.click(screen.getByRole("button", { name: en.nav.switchToHindi }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(hi.hero.title);
    expect(document.documentElement.lang).toBe("hi");
    expect(sessionStorage.getItem("auraguide:language")).toBe("hi");
  });

  it("asks for the plan again in the new language once a plan is showing", async () => {
    fetchMock.mockResolvedValue(reply(planFor("New Delhi")));
    const user = userEvent.setup();
    render(<HomePage />);
    await user.click(createPlanButton());
    await screen.findByRole("heading", { level: 1, name: /New Delhi/ });

    await user.click(screen.getByRole("button", { name: en.nav.switchToHindi }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(bodyOfCall(1).language).toBe("hi");
    expect(bodyOfCall(1).city).toBe("New Delhi");
    expect(document.documentElement.lang).toBe("hi");
    // The results are still on screen, now in Hindi.
    expect(screen.getByRole("heading", { level: 1 }).textContent?.includes("New Delhi")).toBe(true);
  });

  it("writes the plan again if the language changes while it is loading", async () => {
    const first = deferred<ReturnType<typeof reply>>();
    fetchMock.mockReturnValueOnce(first.promise).mockResolvedValue(reply(planFor("New Delhi")));
    const user = userEvent.setup();
    render(<HomePage />);

    await user.click(createPlanButton());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole("button", { name: en.nav.switchToBengali }));
    first.resolve(reply(planFor("New Delhi")));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(bodyOfCall(0).language).toBe("en");
    expect(bodyOfCall(1).language).toBe("bn");
    await screen.findByRole("heading", { level: 1, name: /New Delhi/ });
  });

  it.each([
    ["city_not_found", 404, en.errors.city_not_found],
    ["rate_limited", 429, en.errors.rate_limited],
    ["internal_error", 500, en.errors.internal_error],
  ])("shows a readable message for %s and keeps the form", async (code, status, message) => {
    fetchMock.mockResolvedValue(reply({ code }, status));
    const user = userEvent.setup();
    render(<HomePage />);

    await user.click(createPlanButton());

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(message);
    expect(cityField().value).toBe("New Delhi");
    // The form is usable again.
    await waitFor(() => expect((createPlanButton() as HTMLButtonElement).disabled).toBe(false));
  });

  it("shows a network message when the server cannot be reached", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const user = userEvent.setup();
    render(<HomePage />);

    await user.click(createPlanButton());

    expect((await screen.findByRole("alert")).textContent).toContain(en.errors.network);
  });

  it("clears an error once the person dismisses it", async () => {
    fetchMock.mockResolvedValue(reply({ code: "rate_limited" }, 429));
    const user = userEvent.setup();
    render(<HomePage />);
    await user.click(createPlanButton());
    await screen.findByRole("alert");

    await user.click(screen.getByRole("button", { name: en.errors.dismiss }));

    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("returns to the form with the last household after New profile", async () => {
    fetchMock.mockResolvedValue(reply(planFor("Kolkata")));
    const user = userEvent.setup();
    render(<HomePage />);
    await user.clear(cityField());
    await user.type(cityField(), "Kolkata");
    await user.click(createPlanButton());
    await screen.findByRole("heading", { level: 1, name: /Kolkata/ });

    await user.click(screen.getByRole("button", { name: en.nav.newProfile }));

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(en.hero.title);
    expect(cityField().value).toBe("Kolkata");
    expect(screen.queryByRole("button", { name: en.nav.newProfile })).toBeNull();
  });

  it("saves the household for this tab", async () => {
    fetchMock.mockResolvedValue(reply(planFor("New Delhi")));
    const user = userEvent.setup();
    render(<HomePage />);
    await user.click(createPlanButton());
    await screen.findByRole("heading", { level: 1, name: /New Delhi/ });

    const stored = JSON.parse(sessionStorage.getItem("auraguide:profile") ?? "null");
    expect(stored.city).toBe("New Delhi");
    expect(stored.members.length).toBe(2);
  });

  it("restores a saved household and language", async () => {
    sessionStorage.setItem("auraguide:profile", JSON.stringify(makeProfile({ city: "Patna" })));
    sessionStorage.setItem("auraguide:language", "bn");
    render(<HomePage />);

    await waitFor(() => expect(cityField(bn.form.city).value).toBe("Patna"));
    expect(document.documentElement.lang).toBe("bn");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(bn.hero.title);
  });

  it("ignores saved data that is damaged or has the wrong shape", async () => {
    sessionStorage.setItem("auraguide:profile", JSON.stringify({ city: 42, members: "nope" }));
    sessionStorage.setItem("auraguide:language", "klingon");
    render(<HomePage />);

    await waitFor(() => expect(document.documentElement.lang).toBe("en"));
    expect(cityField().value).toBe("New Delhi");

    cleanup();
    sessionStorage.setItem("auraguide:profile", "{not json");
    render(<HomePage />);
    expect(cityField().value).toBe("New Delhi");
  });

  it("still works when session storage is blocked", async () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    fetchMock.mockResolvedValue(reply(planFor("New Delhi")));
    const user = userEvent.setup();
    render(<HomePage />);

    await user.click(createPlanButton());

    await screen.findByRole("heading", { level: 1, name: /New Delhi/ });
    getItem.mockRestore();
    setItem.mockRestore();
  });

  it("has no accessibility violations on the form page", async () => {
    render(<HomePage />);
    expect(await accessibilityProblems(document.body, { landmarks: true })).toEqual([]);
  });

  it("has no accessibility violations on the results page", async () => {
    fetchMock.mockResolvedValue(reply(planFor("New Delhi")));
    const user = userEvent.setup();
    render(<HomePage />);
    await user.click(createPlanButton());
    await screen.findByRole("heading", { level: 1, name: /New Delhi/ });

    expect(await accessibilityProblems(document.body, { landmarks: true })).toEqual([]);
  });
});
