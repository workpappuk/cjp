import { describe, expect, it, beforeEach } from "vitest";
import {
  AUTH_PROVIDER_KEY,
  ACCESS_TOKEN_KEY,
  ACCESS_TOKEN_EXPIRY_KEY,
  clearAuthSession,
  createAuthSession,
  generateAccessToken,
  getAuthHeaders,
  getAccessToken,
  isAuthenticated,
  withAuthFetchInit,
} from "@/app/_utils/auth";

describe("auth session lifecycle", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("supports login and token retrieval", () => {
    const token = createAuthSession("google");

    expect(token).toBeTruthy();
    expect(window.localStorage.getItem(AUTH_PROVIDER_KEY)).toBe("google");
    expect(getAccessToken()).toBeTruthy();
    expect(isAuthenticated()).toBe(true);
  });

  it("supports logout and session cleanup", () => {
    createAuthSession("google");
    clearAuthSession();

    expect(window.localStorage.getItem(AUTH_PROVIDER_KEY)).toBeNull();
    expect(window.localStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
    expect(isAuthenticated()).toBe(false);
  });

  it("invalidates expired sessions", () => {
    window.localStorage.setItem(AUTH_PROVIDER_KEY, "google");
    window.localStorage.setItem(ACCESS_TOKEN_KEY, "tf_token");
    window.localStorage.setItem(ACCESS_TOKEN_EXPIRY_KEY, String(Date.now() - 1));

    expect(getAccessToken()).toBeNull();
    expect(isAuthenticated()).toBe(false);
  });

  it("invalidates session when expiry is non-numeric", () => {
    window.localStorage.setItem(AUTH_PROVIDER_KEY, "google");
    window.localStorage.setItem(ACCESS_TOKEN_KEY, "tf_token");
    window.localStorage.setItem(ACCESS_TOKEN_EXPIRY_KEY, "not-a-number");

    expect(getAccessToken()).toBeNull();
    expect(isAuthenticated()).toBe(false);
  });

  it("treats missing token as invalid", () => {
    window.localStorage.setItem(AUTH_PROVIDER_KEY, "google");
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);

    expect(getAccessToken()).toBeNull();
    expect(isAuthenticated()).toBe(false);
  });

  it("generates token with expected prefix", () => {
    const token = generateAccessToken("google");
    expect(token.startsWith("tf_google_")).toBe(true);
  });

  it("creates session with explicit access token", () => {
    const explicitToken = "tf_custom_token";
    const token = createAuthSession("github", explicitToken);

    expect(token).toBe(explicitToken);
    expect(window.localStorage.getItem(ACCESS_TOKEN_KEY)).toBe(explicitToken);
  });

  it("builds auth headers when token is present", () => {
    createAuthSession("discord", "tf_discord_token");
    const headers = getAuthHeaders();

    expect(headers.get("Authorization")).toBe("Bearer tf_discord_token");
  });

  it("returns unchanged headers when no token exists", () => {
    clearAuthSession();
    const headers = getAuthHeaders({ "X-Trace": "trace-1" });

    expect(headers.get("Authorization")).toBeNull();
    expect(headers.get("X-Trace")).toBe("trace-1");
  });

  it("withAuthFetchInit merges existing init and auth headers", () => {
    createAuthSession("google", "tf_google_token");
    const init = withAuthFetchInit({
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    const headers = new Headers(init.headers);
    expect(init.method).toBe("POST");
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("Authorization")).toBe("Bearer tf_google_token");
  });
});
