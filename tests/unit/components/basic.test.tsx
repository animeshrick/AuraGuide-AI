// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AQIBadge } from "@/components/AQIBadge";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { StatusBanner } from "@/components/StatusBanner";
import { getDictionary } from "@/i18n";
import { accessibilityProblems } from "../helpers/axe";

describe("AQIBadge", () => {
  it("shows the number and the category in words, so colour is never the only signal", () => {
    const { container } = render(<AQIBadge aqi={245} category="Poor" />);
    expect(container.textContent).toContain("245");
    expect(container.textContent).toContain("Poor");
  });

  it("reads out the AQI label before the number for screen readers", () => {
    render(<AQIBadge aqi={245} category="Poor" aqiLabel="एक्यूआई" />);
    const hidden = document.querySelector(".sr-only");
    expect(hidden?.textContent).toContain("एक्यूआई");
  });

  it("can show a translated category", () => {
    const { container } = render(<AQIBadge aqi={120} category="Moderate" categoryLabel="मध्यम" />);
    expect(container.textContent).toContain("मध्यम");
    expect(container.textContent).not.toContain("Moderate");
  });

  it("can hide the category text when a nearby label already says it", () => {
    const { container } = render(<AQIBadge aqi={120} category="Moderate" showLabel={false} />);
    expect(container.textContent).not.toContain("Moderate");
  });
});

describe("Navbar", () => {
  it("marks the chosen language as pressed", () => {
    render(<Navbar currentLanguage="hi" onLanguageChange={() => {}} />);
    const pressed = (name: string) =>
      screen.getByRole("button", { name: new RegExp(name) }).getAttribute("aria-pressed");
    const hi = getDictionary("hi").nav;
    expect(pressed(hi.switchToHindi)).toBe("true");
    expect(pressed(hi.switchToEnglish)).toBe("false");
  });

  it("tells the page which language was chosen", async () => {
    const onLanguageChange = vi.fn();
    render(<Navbar currentLanguage="en" onLanguageChange={onLanguageChange} />);

    await userEvent.click(
      screen.getByRole("button", { name: new RegExp(getDictionary("en").nav.switchToBengali) })
    );
    expect(onLanguageChange).toHaveBeenCalledWith("bn");
  });

  it("marks each language button with its own language for screen readers", () => {
    render(<Navbar currentLanguage="en" onLanguageChange={() => {}} />);
    expect(
      screen
        .getByRole("button", { name: new RegExp(getDictionary("en").nav.switchToHindi) })
        .getAttribute("lang")
    ).toBe("hi");
    expect(
      screen
        .getByRole("button", { name: new RegExp(getDictionary("en").nav.switchToBengali) })
        .getAttribute("lang")
    ).toBe("bn");
  });

  it("starts with a skip link to the main content", () => {
    render(<Navbar currentLanguage="en" onLanguageChange={() => {}} />);
    const link = screen.getByRole("link", { name: "Skip to main content" });
    expect(link.getAttribute("href")).toBe("#main-content");
    expect(document.body.querySelector("a, button")).toBe(link);
  });

  it("offers a way back to the form only when there is a plan", async () => {
    const onReset = vi.fn();
    const { rerender } = render(
      <Navbar currentLanguage="en" onLanguageChange={() => {}} onReset={onReset} hasPlan={false} />
    );
    expect(screen.queryByRole("button", { name: "New profile" })).toBeNull();

    rerender(<Navbar currentLanguage="en" onLanguageChange={() => {}} onReset={onReset} hasPlan />);
    await userEvent.click(screen.getByRole("button", { name: "New profile" }));
    expect(onReset).toHaveBeenCalled();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <Navbar currentLanguage="en" onLanguageChange={() => {}} hasPlan onReset={() => {}} />
    );
    expect(await accessibilityProblems(container)).toEqual([]);
  });
});

describe("StatusBanner", () => {
  it("interrupts screen readers for errors only", () => {
    const { rerender } = render(<StatusBanner tone="error">Broken</StatusBanner>);
    expect(screen.getByRole("alert").textContent).toContain("Broken");

    rerender(<StatusBanner tone="info">Heads up</StatusBanner>);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("Heads up");
  });

  it("can be dismissed", async () => {
    const onDismiss = vi.fn();
    render(
      <StatusBanner tone="warning" onDismiss={onDismiss} dismissLabel="Close">
        Careful
      </StatusBanner>
    );
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onDismiss).toHaveBeenCalled();
  });
});

describe("Footer", () => {
  it("states that this is not medical advice and credits Open-Meteo with a safe link", () => {
    const { container } = render(<Footer dict={getDictionary("en")} />);
    expect(container.textContent).toMatch(/not medical advice/i);
    expect(container.textContent).toMatch(/CC BY 4\.0/);

    const link = screen.getByRole("link", { name: "Open-Meteo.com" });
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("is written in the chosen language", () => {
    const { container } = render(<Footer dict={getDictionary("bn")} />);
    expect(container.textContent).toMatch(/চিকিৎসা পরামর্শ নয়/);
  });
});
