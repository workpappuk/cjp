import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderWithProviders, waitForLoading } from "@/tests/utils/test-helpers";
import AuthSessionSync from "@/app/_components/AuthSessionSync";
import {
  ACCESS_TOKEN_EXPIRY_KEY,
  ACCESS_TOKEN_KEY,
  AUTH_PROVIDER_KEY,
  USER_PROFILE_KEY,
} from "@/app/_utils/auth";

const useSessionMock = vi.hoisted(() => vi.fn());
const clearAuthSessionMock = vi.hoisted(() => vi.fn());

vi.mock("next-auth/react", async () => {
  const actual = await vi.importActual<typeof import("next-auth/react")>("next-auth/react");
  return {
    ...actual,
    useSession: useSessionMock,
  };
});

vi.mock("@/app/_utils/auth", async () => {
  const actual = await vi.importActual<typeof import("@/app/_utils/auth")>("@/app/_utils/auth");
  return {
    ...actual,
    clearAuthSession: clearAuthSessionMock,
  };
});

describe("AuthSessionSync integration", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it("clears auth when session is unauthenticated", async () => {
    useSessionMock.mockReturnValue({ status: "unauthenticated", data: null });

    renderWithProviders(<AuthSessionSync />);

    await waitForLoading(() => {
      expect(clearAuthSessionMock).toHaveBeenCalledTimes(1);
    });
  });

  it("stores provider, token and user profile when authenticated", async () => {
    useSessionMock.mockReturnValue({
      status: "authenticated",
      data: {
        provider: "google",
        accessToken: "tf_sync_token",
        user: { email: "user@test.threadforge.dev" },
      },
    });

    renderWithProviders(<AuthSessionSync />);

    await waitForLoading(() => {
      expect(window.localStorage.getItem(AUTH_PROVIDER_KEY)).toBe("google");
      expect(window.localStorage.getItem(ACCESS_TOKEN_KEY)).toBe("tf_sync_token");
      expect(window.localStorage.getItem(USER_PROFILE_KEY)).toContain("user@test.threadforge.dev");
      expect(window.localStorage.getItem(ACCESS_TOKEN_EXPIRY_KEY)).toBeTruthy();
    });
  });
});
