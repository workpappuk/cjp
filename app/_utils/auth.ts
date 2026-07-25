export const AUTH_PROVIDER_KEY = "threadforge-auth";
export const ACCESS_TOKEN_KEY = "threadforge-access-token";
export const ACCESS_TOKEN_EXPIRY_KEY = "threadforge-access-token-expiry";
export const USER_PROFILE_KEY = "threadforge-user-profile";

const ACCESS_TOKEN_TTL_MS = 1000 * 60 * 60 * 24;

export type SocialProvider = "google" | "github" | "discord";

function nowMs() {
  return Date.now();
}

function isBrowser() {
  return typeof window !== "undefined";
}

export function generateAccessToken(provider: SocialProvider) {
  const issuedAt = nowMs();
  const payload = {
    provider,
    iat: issuedAt,
    nonce: crypto.randomUUID(),
  };

  // UI-only token shape for local dev until backend OAuth token exchange is added.
  const encodedPayload = btoa(JSON.stringify(payload)).replace(/=+$/g, "");
  return `tf_${provider}_${encodedPayload}`;
}

export function createAuthSession(provider: SocialProvider, accessToken?: string) {
  if (!isBrowser()) return "";

  const token = accessToken ?? generateAccessToken(provider);
  const expiresAt = String(nowMs() + ACCESS_TOKEN_TTL_MS);

  window.localStorage.setItem(AUTH_PROVIDER_KEY, provider);
  window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
  window.localStorage.setItem(ACCESS_TOKEN_EXPIRY_KEY, expiresAt);

  return token;
}

export function clearAuthSession() {
  if (!isBrowser()) return;

  window.localStorage.removeItem(AUTH_PROVIDER_KEY);
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(ACCESS_TOKEN_EXPIRY_KEY);
  window.localStorage.removeItem(USER_PROFILE_KEY);
}

export function getAccessToken() {
  if (!isBrowser()) return null;

  const token = window.localStorage.getItem(ACCESS_TOKEN_KEY);
  const expiresAtRaw = window.localStorage.getItem(ACCESS_TOKEN_EXPIRY_KEY);

  if (!token || !expiresAtRaw) {
    return null;
  }

  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || nowMs() >= expiresAt) {
    clearAuthSession();
    return null;
  }

  return token;
}

export function isAuthenticated() {
  if (!isBrowser()) return false;

  const provider = window.localStorage.getItem(AUTH_PROVIDER_KEY);
  return Boolean(provider && getAccessToken());
}

export function getAuthHeaders(headers?: HeadersInit) {
  const token = getAccessToken();
  const merged = new Headers(headers ?? {});

  if (token) {
    merged.set("Authorization", `Bearer ${token}`);
  }

  return merged;
}

export function withAuthFetchInit(init?: RequestInit): RequestInit {
  return {
    ...init,
    headers: getAuthHeaders(init?.headers),
  };
}
