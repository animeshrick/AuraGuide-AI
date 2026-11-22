// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { sessionStore } from "@/hooks/sessionStore";
import { makeProfile } from "../helpers/fixtures";

afterEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("sessionStore", () => {
  it("saves and reads back the language and household", () => {
    const profile = makeProfile({ city: "Patna" });
    sessionStore.saveLanguage("bn");
    sessionStore.saveProfile(profile);
    expect(sessionStore.readLanguage()).toBe("bn");
    expect(sessionStore.readProfile()?.city).toBe("Patna");
  });

  it("ignores values that are missing, unknown or damaged", () => {
    expect(sessionStore.readLanguage()).toBeUndefined();
    expect(sessionStore.readProfile()).toBeUndefined();
    sessionStorage.setItem("auraguide:language", "fr");
    sessionStorage.setItem("auraguide:profile", "{not json");
    expect(sessionStore.readLanguage()).toBeUndefined();
    expect(sessionStore.readProfile()).toBeUndefined();
  });

  it("keeps working when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => sessionStore.saveLanguage("hi")).not.toThrow();
    expect(sessionStore.readLanguage()).toBeUndefined();
    expect(sessionStore.readProfile()).toBeUndefined();
  });
});
