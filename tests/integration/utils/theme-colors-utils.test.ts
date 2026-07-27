import { describe, expect, it } from "vitest";
import { getThemeColorTokens } from "@/app/_utils/theme-colors";

describe("theme color tokens", () => {
  it("returns orange theme tokens", () => {
    const tokens = getThemeColorTokens("orange");
    expect(tokens.buttonColor).toBe("orange");
    expect(tokens.toggle.on).toContain("orange");
  });

  it("returns emerald theme tokens", () => {
    const tokens = getThemeColorTokens("emerald");
    expect(tokens.buttonColor).toBe("green");
    expect(tokens.accent.heading).toContain("emerald");
  });

  it("returns sky theme tokens", () => {
    const tokens = getThemeColorTokens("sky");
    expect(tokens.buttonColor).toBe("blue");
    expect(tokens.accent.link).toContain("sky");
  });

  it("falls back to orange when theme is invalid", () => {
    const tokens = getThemeColorTokens("invalid" as never);
    expect(tokens.buttonColor).toBe("orange");
  });
});
