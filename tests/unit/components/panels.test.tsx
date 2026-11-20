// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CommunityAdvisory } from "@/components/CommunityAdvisory";
import { WhatIfPanel } from "@/components/WhatIfPanel";
import { getDictionary, type SupportedLanguage } from "@/i18n";
import { accessibilityProblems } from "../helpers/axe";
import { makeMember, makeProfile } from "../helpers/fixtures";

const fetchMock = vi.fn();

function reply(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const profile = makeProfile({
  members: [makeMember({ id: "m1", name: "Rajesh" }), makeMember({ id: "m2", name: "Meera" })],
});

function sentBody(call = 0) {
  const [, init] = fetchMock.mock.calls[call];
  return JSON.parse((init as RequestInit).body as string);
}

const matched = {
  matched: true,
  question: "What if Rajesh took the metro?",
  currentAQI: 210,
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
  explanation: "The metro cuts tailpipe emissions.",
  explanationSource: "rules",
};

describe("WhatIfPanel", () => {
  const dict = getDictionary("en");

  function renderPanel(language: SupportedLanguage = "en") {
    return render(
      <WhatIfPanel profile={profile} language={language} dict={getDictionary(language)} />
    );
  }

  it("sends the question, the chosen member and the language", async () => {
    fetchMock.mockResolvedValue(reply(matched));
    const user = userEvent.setup();
    renderPanel("hi");

    const hi = getDictionary("hi");
    await user.selectOptions(screen.getByLabelText(hi.whatIf.who), "m2");
    await user.type(screen.getByLabelText(hi.whatIf.question), "  What if Meera took the metro?  ");
    await user.click(screen.getByRole("button", { name: hi.whatIf.ask }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][0]).toBe("/api/whatif");
    const body = sentBody();
    expect(body.question).toBe("What if Meera took the metro?");
    expect(body.memberId).toBe("m2");
    expect(body.language).toBe("hi");
    expect(body.profile.city).toBe("New Delhi");
  });

  it("shows the recalculated numbers and the explanation", async () => {
    fetchMock.mockResolvedValue(reply(matched));
    const user = userEvent.setup();
    renderPanel();

    await user.type(screen.getByLabelText(dict.whatIf.question), "What if Rajesh took the metro?");
    await user.click(screen.getByRole("button", { name: dict.whatIf.ask }));

    const heading = await screen.findByRole("heading", { level: 3 });
    expect(heading.textContent).toBe("A good change for Rajesh");
    expect(screen.getByText("The metro cuts tailpipe emissions.")).toBeTruthy();
    expect(screen.getByText("20% cleaner")).toBeTruthy();
    expect(screen.getByText("2.1 kg less")).toBeTruthy();
    expect(
      screen.getByText("Changing from a petrol or diesel car to the metro or train")
    ).toBeTruthy();
    expect(screen.getByText(new RegExp(dict.whatIf.viaRules))).toBeTruthy();
  });

  it("explains what the section is for, in plain words", () => {
    renderPanel();
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(
      "What if I travel a different way?"
    );
    expect(screen.getByText(/better for your health and for the air/)).toBeTruthy();
    expect(screen.getByText(dict.whatIf.pickMode)).toBeTruthy();
  });

  it("offers big travel buttons, without the way the person already travels", () => {
    renderPanel();
    const group = screen.getByRole("group", { name: dict.whatIf.pickMode });
    const names = within(group)
      .getAllByRole("button")
      .map((b) => b.textContent);
    expect(names).toEqual([
      "Metro or train",
      "Bus",
      "Bicycle",
      "Walking",
      "Electric car",
      "Stay at home",
    ]);

    cleanup();
    const metroRider = makeProfile({
      members: [makeMember({ id: "m1", name: "Meera", commuteMode: "metro" })],
    });
    render(<WhatIfPanel profile={metroRider} language="en" dict={dict} />);
    expect(screen.queryByRole("button", { name: "Metro or train" })).toBeNull();
    expect(screen.getByRole("button", { name: "Bus" })).toBeTruthy();
  });

  it("sends the tapped mode straight away, without typing", async () => {
    fetchMock.mockResolvedValue(reply(matched));
    const user = userEvent.setup();
    renderPanel();

    const metro = screen.getByRole("button", { name: dict.whatIf.options.metro });
    expect(metro.getAttribute("aria-pressed")).toBe("false");
    await user.click(metro);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = sentBody();
    expect(body.toMode).toBe("metro");
    expect(body.memberId).toBe("m1");
    expect(body.question).toContain("Rajesh");
    await screen.findByRole("heading", { level: 3 });
    expect(metro.getAttribute("aria-pressed")).toBe("true");
  });

  it("does not send a mode when the person types their own question", async () => {
    fetchMock.mockResolvedValue(reply(matched));
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole("button", { name: dict.whatIf.options.metro }));
    await screen.findByRole("heading", { level: 3 });
    await user.type(screen.getByLabelText(dict.whatIf.question), "What if I cycle?");
    await user.click(screen.getByRole("button", { name: dict.whatIf.ask }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(sentBody(1).toMode).toBeUndefined();
    expect(
      screen.getByRole("button", { name: dict.whatIf.options.metro }).getAttribute("aria-pressed")
    ).toBe("false");
  });

  it("clears the answer when a different person is chosen", async () => {
    fetchMock.mockResolvedValue(reply(matched));
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole("button", { name: dict.whatIf.options.metro }));
    await screen.findByRole("heading", { level: 3 });

    await user.selectOptions(screen.getByLabelText(dict.whatIf.who), "m2");
    expect(screen.queryByRole("heading", { level: 3 })).toBeNull();
  });

  it("says so, and shows no travel buttons, for someone who does not travel", async () => {
    const mixed = makeProfile({
      members: [
        makeMember({ id: "m1", name: "Rajesh" }),
        makeMember({ id: "m2", name: "Meena", commuteMode: "homemaker", commuteDistanceKm: 0 }),
      ],
    });
    const user = userEvent.setup();
    render(<WhatIfPanel profile={mixed} language="en" dict={dict} />);

    await user.selectOptions(screen.getByLabelText(dict.whatIf.who), "m2");
    expect(
      screen.getByText(
        "Meena does not travel for work or school, so there is nothing to change here. Choose someone else."
      )
    ).toBeTruthy();
    expect(screen.queryByRole("group", { name: dict.whatIf.pickMode })).toBeNull();
  });

  it.each([
    [
      "better",
      { exposureChangePercentage: -20, savedEmissionsKg: 2.1 },
      "A good change for Rajesh",
    ],
    ["mixed", { exposureChangePercentage: 15, savedEmissionsKg: 2.1 }, "A mixed result for Rajesh"],
    [
      "same",
      { exposureChangePercentage: 0, savedEmissionsKg: 0 },
      "Almost no difference for Rajesh",
    ],
    [
      "worse",
      { exposureChangePercentage: 12, savedEmissionsKg: -1.5 },
      "Not a good change for Rajesh",
    ],
  ])("shows a %s verdict in words", async (_name, numbers, title) => {
    fetchMock.mockResolvedValue(reply({ ...matched, ...numbers }));
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole("button", { name: dict.whatIf.options.metro }));
    expect((await screen.findByRole("heading", { level: 3 })).textContent).toBe(title);
  });

  it("describes a worse result in plain words, with more fumes and dirtier air", async () => {
    fetchMock.mockResolvedValue(
      reply({
        ...matched,
        fromMode: "metro",
        toMode: "car_ice",
        householdBaselineEmissionsKg: 3.1,
        householdRecalculatedEmissionsKg: 5.2,
        savedEmissionsKg: -2.1,
        exposureChangePercentage: 12,
      })
    );
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole("button", { name: dict.whatIf.options.bus }));
    await screen.findByRole("heading", { level: 3 });
    expect(screen.getByText("12% more polluted")).toBeTruthy();
    expect(screen.getByText("2.1 kg more")).toBeTruthy();
  });

  it("keeps the bars out of the reading order, because the words say the same thing", async () => {
    fetchMock.mockResolvedValue(reply(matched));
    const user = userEvent.setup();
    const { container } = renderPanel();

    await user.click(screen.getByRole("button", { name: dict.whatIf.options.metro }));
    await screen.findByRole("heading", { level: 3 });
    const bars = container.querySelectorAll('[aria-hidden="true"] [style*="width"]');
    expect(bars.length).toBe(4);
  });

  it("shows the answer in Hindi and Bengali", async () => {
    for (const language of ["hi", "bn"] as const) {
      cleanup();
      fetchMock.mockReset().mockResolvedValue(reply(matched));
      const text = getDictionary(language);
      const user = userEvent.setup();
      render(<WhatIfPanel profile={profile} language={language} dict={text} />);

      await user.click(screen.getByRole("button", { name: text.whatIf.options.metro }));
      const heading = await screen.findByRole("heading", { level: 3 });
      expect(heading.textContent).toBe(text.whatIf.verdict.better.replace("{name}", "Rajesh"));
      expect(sentBody().language).toBe(language);
    }
  });

  it("explains an unmatched question using the member's name", async () => {
    fetchMock.mockResolvedValue(
      reply({
        matched: false,
        reason: "same_mode",
        memberId: "m1",
        memberName: "Rajesh",
        fromMode: "car_ice",
        question: "q",
      })
    );
    const user = userEvent.setup();
    renderPanel();

    await user.type(screen.getByLabelText(dict.whatIf.question), "What if Rajesh drove?");
    await user.click(screen.getByRole("button", { name: dict.whatIf.ask }));

    expect(
      await screen.findByText("Rajesh already travels this way. Try a different one.")
    ).toBeTruthy();
  });

  it.each([
    ["rate_limited", 429, "rate_limited"],
    ["invalid_request", 400, "invalid_request"],
    ["internal_error", 500, "internal_error"],
  ])("shows a readable error for %s", async (code, status, key) => {
    fetchMock.mockResolvedValue(reply({ code }, status));
    const user = userEvent.setup();
    renderPanel();

    await user.type(screen.getByLabelText(dict.whatIf.question), "What if Rajesh took the bus?");
    await user.click(screen.getByRole("button", { name: dict.whatIf.ask }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(dict.errors[key as "rate_limited"]);
  });

  it("shows a network error when the request cannot be sent", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const user = userEvent.setup();
    renderPanel();

    await user.type(screen.getByLabelText(dict.whatIf.question), "What if Rajesh took the bus?");
    await user.click(screen.getByRole("button", { name: dict.whatIf.ask }));

    expect((await screen.findByRole("alert")).textContent).toContain(dict.errors.network);
  });

  it("does not send a question that is too short", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.type(screen.getByLabelText(dict.whatIf.question), "hi");
    await user.click(screen.getByRole("button", { name: dict.whatIf.ask }));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("renders the model's explanation as text, never as markup", async () => {
    fetchMock.mockResolvedValue(
      reply({ ...matched, explanation: '<img src=x onerror="window.__pwned=1"><b>bold</b>' })
    );
    const user = userEvent.setup();
    const { container } = renderPanel();

    await user.type(screen.getByLabelText(dict.whatIf.question), "What if Rajesh took the metro?");
    await user.click(screen.getByRole("button", { name: dict.whatIf.ask }));

    await screen.findByRole("heading", { level: 3 });
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
    expect(container.textContent).toContain("<img src=x");
  });

  it("has no accessibility violations, with and without an answer", async () => {
    fetchMock.mockResolvedValue(reply(matched));
    const user = userEvent.setup();
    const { container } = renderPanel();
    expect(await accessibilityProblems(container)).toEqual([]);

    await user.type(screen.getByLabelText(dict.whatIf.question), "What if Rajesh took the metro?");
    await user.click(screen.getByRole("button", { name: dict.whatIf.ask }));
    await screen.findByRole("heading", { level: 3 });
    expect(await accessibilityProblems(container)).toEqual([]);
  });
});

describe("CommunityAdvisory", () => {
  const dict = getDictionary("en");
  const advisory = {
    city: "New Delhi",
    currentAQI: 310,
    category: "very_poor",
    audience: "housing_society",
    dataSource: "open-meteo",
    advisoryText: "Notice to residents: keep windows shut this evening & avoid outdoor play.",
    advisorySource: "rules",
  };

  function renderAdvisory(language: SupportedLanguage = "en") {
    return render(
      <CommunityAdvisory city="New Delhi" language={language} dict={getDictionary(language)} />
    );
  }

  it("offers three audiences and starts with housing societies", () => {
    renderAdvisory();
    const group = screen.getByRole("group", { name: dict.advisory.audience });
    const radios = within(group).getAllByRole("radio") as HTMLInputElement[];
    expect(radios).toHaveLength(3);
    expect(radios.find((r) => r.checked)?.value).toBe("housing_society");
  });

  it("requests an advisory for the chosen audience and language", async () => {
    fetchMock.mockResolvedValue(reply({ ...advisory, audience: "school" }));
    const user = userEvent.setup();
    renderAdvisory("bn");
    const bn = getDictionary("bn");

    await user.click(screen.getByRole("radio", { name: bn.advisory.audiences.school }));
    await user.click(screen.getByRole("button", { name: bn.advisory.generate }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][0]).toBe("/api/advisory");
    expect(sentBody()).toEqual({ city: "New Delhi", audience: "school", language: "bn" });
  });

  it("shows the advisory text and where it came from", async () => {
    fetchMock.mockResolvedValue(reply(advisory));
    const user = userEvent.setup();
    renderAdvisory();

    await user.click(screen.getByRole("button", { name: dict.advisory.generate }));

    expect(await screen.findByText(advisory.advisoryText)).toBeTruthy();
    expect(screen.getByText(dict.advisory.viaRules)).toBeTruthy();
  });

  it("copies the advisory text to the clipboard", async () => {
    fetchMock.mockResolvedValue(reply(advisory));
    const user = userEvent.setup();
    renderAdvisory();

    await user.click(screen.getByRole("button", { name: dict.advisory.generate }));
    await screen.findByText(advisory.advisoryText);
    await user.click(screen.getByRole("button", { name: dict.advisory.copy }));

    expect(await navigator.clipboard.readText()).toBe(advisory.advisoryText);
    expect(await screen.findByRole("button", { name: dict.advisory.copied })).toBeTruthy();
  });

  it("says so when the clipboard is not available", async () => {
    fetchMock.mockResolvedValue(reply(advisory));
    const user = userEvent.setup();
    renderAdvisory();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));

    await user.click(screen.getByRole("button", { name: dict.advisory.generate }));
    await screen.findByText(advisory.advisoryText);
    await user.click(screen.getByRole("button", { name: dict.advisory.copy }));

    expect((await screen.findByRole("status")).textContent).toContain(dict.advisory.copyFailed);
  });

  it("builds a safe WhatsApp share link", async () => {
    fetchMock.mockResolvedValue(reply(advisory));
    const user = userEvent.setup();
    renderAdvisory();

    await user.click(screen.getByRole("button", { name: dict.advisory.generate }));
    await screen.findByText(advisory.advisoryText);

    const link = screen.getByRole("link", { name: dict.advisory.shareWhatsApp });
    expect(link.getAttribute("href")).toBe(
      `https://wa.me/?text=${encodeURIComponent(advisory.advisoryText)}`
    );
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("shows an error banner when the request fails", async () => {
    fetchMock.mockResolvedValue(reply({ code: "city_not_found" }, 404));
    const user = userEvent.setup();
    renderAdvisory();

    await user.click(screen.getByRole("button", { name: dict.advisory.generate }));

    expect((await screen.findByRole("alert")).textContent).toContain(dict.errors.city_not_found);
  });

  it("renders the model's text as plain text", async () => {
    fetchMock.mockResolvedValue(
      reply({ ...advisory, advisoryText: '<img src=x onerror="window.__pwned=1"> hello' })
    );
    const user = userEvent.setup();
    const { container } = renderAdvisory();

    await user.click(screen.getByRole("button", { name: dict.advisory.generate }));
    await screen.findByText(/hello/);

    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("<img src=x");
  });

  it("has no accessibility violations, with and without a result", async () => {
    fetchMock.mockResolvedValue(reply(advisory));
    const user = userEvent.setup();
    const { container } = renderAdvisory();
    expect(await accessibilityProblems(container)).toEqual([]);

    await user.click(screen.getByRole("button", { name: dict.advisory.generate }));
    await screen.findByText(advisory.advisoryText);
    expect(await accessibilityProblems(container)).toEqual([]);
  });
});
