import { afterEach, describe, expect, it, vi } from "vitest";
import { errorMessage, logger } from "@/lib/logger";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("errorMessage", () => {
  it("returns the message of an Error", () => {
    expect(errorMessage(new Error("boom"))).toBe("boom");
  });

  it("returns 'unknown' for anything that is not an Error", () => {
    expect(errorMessage("boom")).toBe("unknown");
    expect(errorMessage(null)).toBe("unknown");
    expect(errorMessage({ message: "boom" })).toBe("unknown");
  });
});

describe("logger", () => {
  it("writes an error with its detail as a separate value", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logger.error("Request failed:", "timeout");
    expect(spy).toHaveBeenCalledWith("Request failed:", "timeout");
  });

  it("writes a message on its own when there is no detail", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logger.error("Request failed");
    expect(spy).toHaveBeenCalledWith("Request failed");
  });

  it("writes warnings to the warning stream", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    logger.warn("Using the fallback:", "service down");
    expect(warn).toHaveBeenCalledWith("Using the fallback:", "service down");
    expect(error).not.toHaveBeenCalled();
  });
});
