/** @vitest-environment node */

import { describe, expect, it } from "vitest";
import {
  clearAuthSession,
  createAuthSession,
  getAccessToken,
  isAuthenticated,
} from "@/app/_utils/auth";

describe("auth session helpers in non-browser environment", () => {
  it("returns safe defaults without window", () => {
    const token = createAuthSession("google");

    expect(token).toBe("");
    expect(getAccessToken()).toBeNull();
    expect(isAuthenticated()).toBe(false);
    expect(() => clearAuthSession()).not.toThrow();
  });
});
