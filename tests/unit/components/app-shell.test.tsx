// @vitest-environment jsdom
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import ErrorPage from "@/app/error";
import RootLayout, { metadata } from "@/app/layout";
import NotFound from "@/app/not-found";

afterEach(cleanup);

describe("app shell pages", () => {
  it("lets the person try again after an error", async () => {
    const reset = vi.fn();
    render(<ErrorPage error={new Error("boom")} reset={reset} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Something went wrong");
    await userEvent.setup().click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("links back home from the 404 page", () => {
    render(<NotFound />);
    expect(screen.getByRole("link", { name: "Back to AuraGuide AI" }).getAttribute("href")).toBe(
      "/"
    );
  });

  it("renders the document shell in English by default", () => {
    const html = renderToStaticMarkup(
      <RootLayout>
        <p>child</p>
      </RootLayout>
    );
    expect(html).toContain('<html lang="en"');
    expect(html).toContain("<p>child</p>");
    expect(metadata.title).toMatch(/AuraGuide AI/);
  });
});
