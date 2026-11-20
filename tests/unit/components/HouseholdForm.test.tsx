// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HouseholdForm } from "@/components/HouseholdForm";
import type { HouseholdProfile } from "@/domain/types";
import { accessibilityProblems } from "../helpers/axe";
import { makeMember, makeProfile } from "../helpers/fixtures";

function setup(props: Partial<React.ComponentProps<typeof HouseholdForm>> = {}) {
  const onSubmit = vi.fn<(profile: HouseholdProfile) => void>();
  const view = render(
    <HouseholdForm language="en" onSubmit={onSubmit} isLoading={false} {...props} />
  );
  const user = userEvent.setup();
  return { onSubmit, user, ...view };
}

const submitButton = () => screen.getByRole("button", { name: /create my day plan/i });
const memberItems = () => screen.getAllByRole("listitem").filter((li) => li.querySelector("h3"));

describe("HouseholdForm", () => {
  it("submits the starting household with the chosen language", async () => {
    const { onSubmit, user } = setup({ language: "hi" });
    await user.click(screen.getByRole("button", { name: /मेरे दिन की योजना बनाएँ/ }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const profile = onSubmit.mock.calls[0][0];
    expect(profile.city).toBe("New Delhi");
    expect(profile.language).toBe("hi");
    expect(profile.members).toHaveLength(2);
  });

  it("labels every field", () => {
    setup();
    expect(screen.getByLabelText("City or region")).toBeTruthy();
    expect(screen.getByLabelText("Main cooking fuel")).toBeTruthy();
    expect(screen.getAllByLabelText("Name")).toHaveLength(2);
    expect(screen.getAllByLabelText("Age")).toHaveLength(2);
    expect(screen.getAllByLabelText("How they travel")).toHaveLength(2);
  });

  it("trims the city and the names", async () => {
    const { onSubmit, user } = setup();
    const city = screen.getByLabelText("City or region");
    await user.clear(city);
    await user.type(city, "  Kolkata  ");
    await user.click(submitButton());
    expect(onSubmit.mock.calls[0][0].city).toBe("Kolkata");
  });

  it("does not submit with an empty or one-letter city", async () => {
    const { onSubmit, user } = setup();
    const city = screen.getByLabelText("City or region");
    await user.clear(city);
    await user.type(city, "K");
    await user.click(submitButton());
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("starts from a household it is given", () => {
    setup({
      initialProfile: makeProfile({ city: "Patna", members: [makeMember({ name: "Manoj" })] }),
    });
    expect((screen.getByLabelText("City or region") as HTMLInputElement).value).toBe("Patna");
    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("Manoj");
  });

  describe("sample households", () => {
    it("fills the whole form", async () => {
      const { user } = setup();
      await user.click(screen.getByRole("button", { name: "Kolkata: commuters and school" }));

      expect((screen.getByLabelText("City or region") as HTMLInputElement).value).toBe("Kolkata");
      const names = screen.getAllByLabelText("Name").map((el) => (el as HTMLInputElement).value);
      expect(names).toEqual(["Ananya (Working Parent)", "Rishi (School Student)"]);
      const ages = screen.getAllByLabelText("Age").map((el) => (el as HTMLInputElement).value);
      expect(ages).toEqual(["36", "10"]);
    });

    it("can be submitted straight away", async () => {
      const { onSubmit, user } = setup();
      await user.click(screen.getByRole("button", { name: "Patna: wood fuel and outdoor work" }));
      await user.click(submitButton());
      const profile = onSubmit.mock.calls[0][0];
      expect(profile.city).toBe("Patna");
      expect(profile.cookingFuel).toBe("biomass");
    });
  });

  describe("members", () => {
    it("adds a member", async () => {
      const { user } = setup();
      await user.click(screen.getByRole("button", { name: "Add member" }));
      expect(memberItems()).toHaveLength(3);
    });

    it("needs a name for a new member before it will submit", async () => {
      const { onSubmit, user } = setup();
      await user.click(screen.getByRole("button", { name: "Add member" }));
      await user.click(submitButton());
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it("stops at ten members", async () => {
      const { user } = setup();
      for (let i = 0; i < 8; i++)
        await user.click(screen.getByRole("button", { name: "Add member" }));
      expect(memberItems()).toHaveLength(10);
      expect(
        (screen.getByRole("button", { name: "Add member" }) as HTMLButtonElement).disabled
      ).toBe(true);
    });

    it("removes a member, but never the last one", async () => {
      const { user } = setup();
      await user.click(screen.getByRole("button", { name: "Remove Meera" }));
      expect(memberItems()).toHaveLength(1);
      expect(screen.queryByRole("button", { name: /^Remove / })).toBeNull();
    });

    it("hides distance and time for someone who stays home, and sends zeros", async () => {
      const { onSubmit, user } = setup();
      const first = memberItems()[0];
      await user.selectOptions(within(first).getByLabelText("How they travel"), "work_from_home");

      expect(within(first).queryByLabelText(/Distance one way/)).toBeNull();
      await user.click(submitButton());
      const member = onSubmit.mock.calls[0][0].members[0];
      expect(member.commuteMode).toBe("work_from_home");
      expect(member.commuteDistanceKm).toBe(0);
      expect(member.commuteTimeMinutes).toBe(0);
    });

    it("sends edited ages and distances as numbers", async () => {
      const { onSubmit, user } = setup();
      const first = memberItems()[0];
      const age = within(first).getByLabelText("Age");
      await user.clear(age);
      await user.type(age, "55");
      const distance = within(first).getByLabelText("Distance one way (km)");
      await user.clear(distance);
      await user.type(distance, "7.5");

      await user.click(submitButton());
      const member = onSubmit.mock.calls[0][0].members[0];
      expect(member.age).toBe(55);
      expect(member.commuteDistanceKm).toBe(7.5);
    });
  });

  describe("health sensitivities", () => {
    it("toggles a sensitivity and reports it with aria-pressed", async () => {
      const { user } = setup();
      const first = memberItems()[0];
      const cardiac = within(first).getByRole("button", { name: "Heart condition" });
      expect(cardiac.getAttribute("aria-pressed")).toBe("false");

      await user.click(cardiac);
      expect(cardiac.getAttribute("aria-pressed")).toBe("true");
      expect(within(first).getByRole("button", { name: "None" }).getAttribute("aria-pressed")).toBe(
        "false"
      );
    });

    it("goes back to None when the last sensitivity is switched off", async () => {
      const { user } = setup();
      const second = memberItems()[1]; // starts with asthma
      await user.click(within(second).getByRole("button", { name: "Asthma or lung condition" }));
      expect(
        within(second).getByRole("button", { name: "None" }).getAttribute("aria-pressed")
      ).toBe("true");
    });

    it("clears the others when None is chosen", async () => {
      const { user } = setup();
      const second = memberItems()[1];
      await user.click(within(second).getByRole("button", { name: "Elderly (60+)" }));
      await user.click(within(second).getByRole("button", { name: "None" }));
      expect(
        within(second).getByRole("button", { name: "Elderly (60+)" }).getAttribute("aria-pressed")
      ).toBe("false");
      expect(
        within(second)
          .getByRole("button", { name: "Asthma or lung condition" })
          .getAttribute("aria-pressed")
      ).toBe("false");
    });
  });

  describe("outdoor routine", () => {
    it("adds an activity, which needs a description", async () => {
      const { onSubmit, user } = setup();
      const first = memberItems()[0];
      await user.click(within(first).getByRole("button", { name: "Add activity" }));
      await user.click(submitButton());
      expect(onSubmit).not.toHaveBeenCalled();

      await user.type(within(first).getByLabelText("What"), "  Evening cricket ");
      await user.click(submitButton());
      expect(onSubmit.mock.calls[0][0].members[0].outdoorActivities).toEqual([
        { description: "Evening cricket", preferredHour: 7, durationMinutes: 30 },
      ]);
    });

    it("edits the hour and the length", async () => {
      const { onSubmit, user } = setup();
      const second = memberItems()[1]; // already has "Morning walk"
      await user.selectOptions(within(second).getByLabelText("Usual start time"), "18");
      const minutes = within(second).getByLabelText("Minutes");
      await user.clear(minutes);
      await user.type(minutes, "45");

      await user.click(submitButton());
      expect(onSubmit.mock.calls[0][0].members[1].outdoorActivities[0]).toMatchObject({
        preferredHour: 18,
        durationMinutes: 45,
      });
    });

    it("removes an activity", async () => {
      const { user } = setup();
      const second = memberItems()[1];
      await user.click(within(second).getByRole("button", { name: /Remove activity 1 for Meera/ }));
      expect(within(second).getByText("No outdoor activities added.")).toBeTruthy();
    });
  });

  it("stops a second submit while it is loading", async () => {
    const { onSubmit, user } = setup({ isLoading: true });
    const button = screen.getByRole("button", { name: /checking the air/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    await user.click(button);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(document.querySelector("form")?.getAttribute("aria-busy")).toBe("true");
  });

  it("speaks Hindi and Bengali", () => {
    const hi = render(<HouseholdForm language="hi" onSubmit={() => {}} isLoading={false} />);
    expect(screen.getByLabelText("शहर या क्षेत्र")).toBeTruthy();
    hi.unmount();

    render(<HouseholdForm language="bn" onSubmit={() => {}} isLoading={false} />);
    expect(screen.getByLabelText("শহর বা অঞ্চল")).toBeTruthy();
  });

  it("has no accessibility violations", async () => {
    const { container } = setup();
    expect(await accessibilityProblems(container)).toEqual([]);
  });
});

describe("HouseholdForm: new members, homemakers and chips", () => {
  it("moves the cursor to the name of a member that was just added", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "Add member" }));

    const names = screen.getAllByLabelText("Name");
    expect(names).toHaveLength(3);
    expect(document.activeElement).toBe(names[2]);
  });

  it("offers a homemaker option under a stays-at-home group", () => {
    setup();
    const first = memberItems()[0];
    const select = within(first).getByLabelText("How they travel") as HTMLSelectElement;

    const homemaker = within(select).getByRole("option", { name: /Homemaker/ });
    expect((homemaker as HTMLOptionElement).value).toBe("homemaker");
    expect(homemaker.parentElement?.getAttribute("label")).toBe("Stays at home");
    expect(within(select).getByRole("option", { name: /Stays home/ })).toBeTruthy();
  });

  it("hides distance and time for a homemaker, and sends zeros", async () => {
    const { onSubmit, user } = setup();
    const first = memberItems()[0];
    await user.selectOptions(within(first).getByLabelText("How they travel"), "homemaker");

    expect(within(first).queryByLabelText(/Distance one way/)).toBeNull();
    expect(within(first).queryByLabelText(/Time one way/)).toBeNull();

    await user.click(submitButton());
    const member = onSubmit.mock.calls[0][0].members[0];
    expect(member.commuteMode).toBe("homemaker");
    expect(member.commuteDistanceKm).toBe(0);
    expect(member.commuteTimeMinutes).toBe(0);
  });

  it("shows the commute fields again when a homemaker starts travelling", async () => {
    const { user } = setup();
    const first = memberItems()[0];
    const select = within(first).getByLabelText("How they travel");
    await user.selectOptions(select, "homemaker");
    await user.selectOptions(select, "bus");
    expect(within(first).getByLabelText(/Distance one way/)).toBeTruthy();
  });

  it("marks a selected health chip with a check, and removes it when cleared", async () => {
    const { user } = setup();
    const first = memberItems()[0];
    const asthma = within(first).getByRole("button", { name: "Asthma or lung condition" });
    expect(asthma.querySelector("svg")).toBeNull();

    await user.click(asthma);
    expect(asthma.getAttribute("aria-pressed")).toBe("true");
    expect(asthma.querySelector("svg")).not.toBeNull();

    await user.click(asthma);
    expect(asthma.getAttribute("aria-pressed")).toBe("false");
    expect(asthma.querySelector("svg")).toBeNull();
  });

  it("has no accessibility problems with the grouped travel list", async () => {
    const { container } = setup();
    expect(await accessibilityProblems(container)).toEqual([]);
  });
});

describe("HouseholdForm: smoking or vaping question", () => {
  it("is an optional checkbox for every member, unchecked at the start", () => {
    setup();
    const boxes = screen.getAllByRole("checkbox", { name: /Smokes or vapes \(optional\)/ });
    expect(boxes).toHaveLength(2);
    for (const box of boxes) expect((box as HTMLInputElement).checked).toBe(false);
    expect(screen.getAllByText(/Leave it blank if you prefer/)).toHaveLength(2);
  });

  it("does not stop the form from being sent when it is left alone", async () => {
    const { onSubmit, user } = setup();
    await user.click(submitButton());
    const members = onSubmit.mock.calls[0][0].members;
    for (const member of members) expect(member.smokes).toBeUndefined();
  });

  it("is sent as true for the member it was ticked for, and for nobody else", async () => {
    const { onSubmit, user } = setup();
    const first = memberItems()[0];
    await user.click(within(first).getByRole("checkbox", { name: /Smokes or vapes/ }));

    await user.click(submitButton());
    const [one, two] = onSubmit.mock.calls[0][0].members;
    expect(one.smokes).toBe(true);
    expect(two.smokes).toBeUndefined();
  });

  it("goes back to not answered when it is unticked", async () => {
    const { onSubmit, user } = setup();
    const first = memberItems()[0];
    const box = within(first).getByRole("checkbox", { name: /Smokes or vapes/ });
    await user.click(box);
    await user.click(box);

    await user.click(submitButton());
    expect(onSubmit.mock.calls[0][0].members[0].smokes).toBeUndefined();
  });

  it("starts ticked for a household that already said so", () => {
    setup({
      initialProfile: makeProfile({ members: [makeMember({ name: "Manoj", smokes: true })] }),
    });
    expect(
      (screen.getByRole("checkbox", { name: /Smokes or vapes/ }) as HTMLInputElement).checked
    ).toBe(true);
  });

  it("is labelled in Hindi", () => {
    setup({ language: "hi" });
    expect(screen.getAllByRole("checkbox", { name: /धूम्रपान या वेप करते हैं/ }).length).toBeGreaterThan(
      0
    );
  });
});
