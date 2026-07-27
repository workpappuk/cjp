import { describe, expect, it } from "vitest";
import { createMaterialTheme } from "@/app/_context/material-theme";

describe("material theme factory", () => {
  it("maps orange theme accent color", () => {
    const theme = createMaterialTheme("orange");
    expect(theme.button.defaultProps.color).toBe("orange");
    expect(theme.iconButton.defaultProps.color).toBe("orange");
  });

  it("maps emerald theme accent color", () => {
    const theme = createMaterialTheme("emerald");
    expect(theme.button.defaultProps.color).toBe("green");
  });

  it("maps sky theme accent color", () => {
    const theme = createMaterialTheme("sky");
    expect(theme.input.defaultProps.color).toBe("blue");
    expect(theme.select.defaultProps.color).toBe("blue");
  });

  it("falls back to orange for invalid theme", () => {
    const theme = createMaterialTheme("invalid" as never);
    expect(theme.chip.defaultProps.color).toBe("orange");
  });
});
