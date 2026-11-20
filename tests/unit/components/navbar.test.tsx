// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Navbar } from "@/components/Navbar";
import { getDictionary, SUPPORTED_LANGUAGES } from "@/i18n";
import { accessibilityProblems } from "../helpers/axe";

afterEach(cleanup);

describe("language switcher", () => {
  it.each(SUPPORTED_LANGUAGES)(
    "keeps the visible text inside each button's accessible name, on the %s page",
    (page) => {
      const dict = getDictionary(page);
      render(<Navbar currentLanguage={page} onLanguageChange={() => undefined} />);

      const group = screen.getByRole("group", { name: dict.nav.languageGroup });
      const buttons = within(group).getAllByRole("button");
      expect(buttons).toHaveLength(3);
      const labels = [dict.nav.switchToEnglish, dict.nav.switchToHindi, dict.nav.switchToBengali];

      // WCAG 2.5.3 Label in Name: whoever says the visible text, such as "EN", must hit the button.
      // The accessible name is the button's text content, so the visible text has to appear in it.
      buttons.forEach((button, i) => {
        const name = (button.textContent ?? "").trim();
        const visible = name.slice(0, name.length - labels[i].length).trim();
        expect(visible.length, `${page}: visible text`).toBeGreaterThan(0);
        expect(name, `${page}: "${name}"`).toContain(visible);
        expect(name, `${page}: "${name}"`).toContain(labels[i]);
      });
    }
  );

  it.each(SUPPORTED_LANGUAGES)("has no accessibility problems on the %s page", async (page) => {
    const { container } = render(
      <Navbar currentLanguage={page} onLanguageChange={() => undefined} />
    );
    expect(await accessibilityProblems(container)).toEqual([]);
  });

  it("lets the header wrap, so the page does not scroll sideways on a phone", () => {
    // With a plan on screen the header holds the title, "New profile" and three language buttons,
    // which do not fit in one row at 375 px. jsdom has no layout, so check the wrapping classes.
    const { container } = render(
      <Navbar
        currentLanguage="en"
        onLanguageChange={() => undefined}
        onReset={() => undefined}
        hasPlan
      />
    );
    const row = container.querySelector("header > div");
    expect(row?.className.split(" ")).toContain("flex-wrap");
    const actions = row?.lastElementChild;
    expect(actions?.className.split(" ")).toContain("flex-wrap");
  });
});
