import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AppNavbar from "@/app/_components/AppNavbar";
import { renderWithProviders, waitForLoading } from "@/tests/utils/test-helpers";
import { USER_PROFILE_KEY } from "@/app/_utils/auth";

const useSessionMock = vi.hoisted(() => vi.fn());
const signOutMock = vi.hoisted(() => vi.fn());
const clearAuthSessionMock = vi.hoisted(() => vi.fn());

vi.mock("next-auth/react", async () => {
  const actual = await vi.importActual<typeof import("next-auth/react")>("next-auth/react");
  return {
    ...actual,
    useSession: useSessionMock,
    signOut: signOutMock,
  };
});

vi.mock("@/app/_utils/auth", async () => {
  const actual = await vi.importActual<typeof import("@/app/_utils/auth")>("@/app/_utils/auth");
  return {
    ...actual,
    clearAuthSession: clearAuthSessionMock,
  };
});

describe("AppNavbar integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            name: "Admin User",
            email: "admin@test.threadforge.dev",
            isAdmin: true,
          }),
          { status: 200 },
        ),
      ),
    );

    useSessionMock.mockReturnValue({
      data: {
        user: {
          name: "Admin User",
          email: "admin@test.threadforge.dev",
        },
      },
    });
  });

  it("opens profile menu and shows admin links", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppNavbar />);

    await waitForLoading(() => {
      expect(window.localStorage.getItem(USER_PROFILE_KEY)).toContain("admin@test.threadforge.dev");
    });

    await user.click(screen.getByRole("button", { name: /open profile menu/i }));

    expect(screen.getByRole("menu", { name: /profile menu/i })).toBeVisible();
    expect(screen.getByRole("menuitem", { name: /admin dashboard/i })).toBeVisible();
    expect(screen.getByRole("menuitem", { name: /moderation/i })).toBeVisible();
  });

  it("logs out using auth helpers", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppNavbar />);

    await user.click(screen.getByRole("button", { name: /open profile menu/i }));
    await user.click(screen.getByRole("menuitem", { name: /logout/i }));

    expect(clearAuthSessionMock).toHaveBeenCalledTimes(1);
    expect(signOutMock).toHaveBeenCalledWith({ callbackUrl: "/" });
  });
});
