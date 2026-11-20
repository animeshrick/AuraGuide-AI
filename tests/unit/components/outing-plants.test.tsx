// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { GoingOutPanel } from "@/components/GoingOutPanel";
import { PlantsPanel } from "@/components/PlantsPanel";
import { formatMessage, getDictionary, type SupportedLanguage } from "@/i18n";
import { accessibilityProblems } from "../helpers/axe";
import { makeMember, makeProfile } from "../helpers/fixtures";
import { hourlyFrom } from "../helpers/hourly-aqi";

afterEach(cleanup);

const valueOf = (el: HTMLElement) => (el as HTMLSelectElement).value;

const profile = makeProfile({
  members: [
    makeMember({ id: "m1", name: "Rajesh", commuteMode: "car_ice" }),
    makeMember({
      id: "m2",
      name: "Meera",
      commuteMode: "auto_rickshaw",
      sensitivities: ["asthma"],
    }),
  ],
});

/** Poor air early in the morning, better by 10:00, clean in the afternoon. */
const hourly = hourlyFrom((h) =>
  h >= 6 && h <= 9 ? 250 : h >= 10 && h <= 11 ? 150 : h >= 12 && h <= 16 ? 60 : 130
);

function renderGoingOut(language: SupportedLanguage = "en", data = hourly) {
  const dict = getDictionary(language);
  return {
    dict,
    ...render(<GoingOutPanel profile={profile} hourly={data} dict={dict} />),
  };
}

describe("PlantsPanel", () => {
  const renderPlants = (p = profile, language: SupportedLanguage = "en") => {
    const dict = getDictionary(language);
    return { dict, ...render(<PlantsPanel profile={p} dict={dict} />) };
  };

  it("says first that plants do not clean smog, then lists easy plants", () => {
    const { dict } = renderPlants();
    expect(screen.getByRole("heading", { name: dict.plants.title, level: 2 })).toBeTruthy();
    expect(screen.getByText(dict.plants.honest)).toBeTruthy();
    expect(screen.getByRole("heading", { name: dict.plants.plants.snake_plant.name })).toBeTruthy();
    expect(screen.getAllByRole("listitem").length).toBeGreaterThanOrEqual(5);
  });

  it("explains why the list was narrowed for a young child and for asthma", () => {
    const withChild = makeProfile({
      members: [makeMember({ age: 4 }), makeMember({ id: "m2", sensitivities: ["asthma"] })],
    });
    const { dict } = renderPlants(withChild);
    expect(screen.getByText(dict.plants.notes.child_safe)).toBeTruthy();
    expect(screen.getByText(dict.plants.notes.asthma_mould)).toBeTruthy();
    expect(screen.queryByText(dict.plants.safeNo)).toBeNull();
  });

  it("marks a plant that is harmful to chew in words, not only colour", () => {
    const { dict } = renderPlants();
    expect(screen.getAllByText(dict.plants.safeNo).length).toBeGreaterThan(0);
    expect(screen.getAllByText(dict.plants.safeYes).length).toBeGreaterThan(0);
  });

  it.each(["hi", "bn"] as const)("is written in %s", (language) => {
    const { dict } = renderPlants(profile, language);
    expect(screen.getByText(dict.plants.title)).toBeTruthy();
    expect(screen.getByText(dict.plants.plants.snake_plant.name)).toBeTruthy();
  });

  it("has no accessibility problems", async () => {
    const { container } = renderPlants();
    expect(await accessibilityProblems(container)).toEqual([]);
  });
});

describe("GoingOutPanel", () => {
  it("starts with the first person, 08:00, and how that person normally travels", () => {
    const { dict } = renderGoingOut();
    expect(valueOf(screen.getByLabelText(dict.outing.who))).toBe("m1");
    expect(valueOf(screen.getByLabelText(dict.outing.when))).toBe("8");
    expect(valueOf(screen.getByLabelText(dict.outing.how))).toBe("closed_vehicle");
  });

  it("gives a verdict in words with the AQI for the chosen hour", () => {
    const { dict } = renderGoingOut();
    // Healthy adult, poor air at 08:00, so go with care.
    expect(
      screen.getByRole("heading", {
        name: formatMessage(dict.outing.verdict.careful, { name: "Rajesh", time: "08:00" }),
      })
    ).toBeTruthy();
    expect(screen.getByText(dict.outing.levels.careful)).toBeTruthy();
    expect(screen.getByText("250")).toBeTruthy();
  });

  it("updates at once when the hour changes, and offers a cleaner time when there is one", async () => {
    const user = userEvent.setup();
    const { dict } = renderGoingOut();

    expect(screen.getByRole("heading", { name: dict.outing.cleanerTitle })).toBeTruthy();

    await user.selectOptions(screen.getByLabelText(dict.outing.when), "14");
    expect(
      screen.getByRole("heading", {
        name: formatMessage(dict.outing.verdict.fine, { name: "Rajesh", time: "14:00" }),
      })
    ).toBeTruthy();
    expect(screen.queryByRole("heading", { name: dict.outing.cleanerTitle })).toBeNull();
    expect(screen.getByText(dict.outing.nothingSpecial)).toBeTruthy();
  });

  it("is stricter for a person with asthma, and says so", async () => {
    const user = userEvent.setup();
    const { dict } = renderGoingOut();

    await user.selectOptions(screen.getByLabelText(dict.outing.who), "m2");
    expect(
      screen.getByRole("heading", {
        name: formatMessage(dict.outing.verdict.avoid, { name: "Meera", time: "08:00" }),
      })
    ).toBeTruthy();
    expect(screen.getByText(formatMessage(dict.outing.stricter, { name: "Meera" }))).toBeTruthy();
    expect(screen.getByText(dict.outing.steps.inhaler)).toBeTruthy();
  });

  it("follows the chosen person's usual way of going, and keeps a way the user picks", async () => {
    const user = userEvent.setup();
    const { dict } = renderGoingOut();
    const how = screen.getByLabelText(dict.outing.how);

    await user.selectOptions(screen.getByLabelText(dict.outing.who), "m2");
    expect(valueOf(how)).toBe("open_vehicle");
    expect(screen.getByText(dict.outing.steps.helmet_mask)).toBeTruthy();

    await user.selectOptions(how, "on_foot");
    expect(screen.getByText(dict.outing.steps.walk_slow)).toBeTruthy();
    expect(screen.queryByText(dict.outing.steps.helmet_mask)).toBeNull();

    // Changing the person goes back to that person's own way of travelling.
    await user.selectOptions(screen.getByLabelText(dict.outing.who), "m1");
    expect(valueOf(how)).toBe("closed_vehicle");
    expect(screen.getByText(dict.outing.steps.recirculate)).toBeTruthy();
  });

  it("lists the steps in order with the safety step last", () => {
    const { dict } = renderGoingOut();
    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items[items.length - 1].textContent).toBe(dict.outing.steps.symptoms);
  });

  it("says so when there is no forecast", () => {
    const { dict } = renderGoingOut("en", []);
    expect(screen.getByText(dict.outing.noData)).toBeTruthy();
  });

  it.each(["hi", "bn"] as const)("is written in %s", (language) => {
    const { dict } = renderGoingOut(language);
    expect(screen.getByText(dict.outing.title)).toBeTruthy();
    expect(screen.getByLabelText(dict.outing.how)).toBeTruthy();
    expect(screen.getByText(dict.outing.steps.symptoms)).toBeTruthy();
  });

  it("has no accessibility problems", async () => {
    const { container } = renderGoingOut();
    expect(await accessibilityProblems(container)).toEqual([]);
  });
});
