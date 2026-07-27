import type { ReactNode } from "react";
import { render, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider as AppThemeProvider } from "@/app/_context/theme-context";
import {
  ACCESS_TOKEN_EXPIRY_KEY,
  ACCESS_TOKEN_KEY,
  AUTH_PROVIDER_KEY,
  USER_PROFILE_KEY,
} from "@/app/_utils/auth";

type RenderOptions = {
  session?: Session | null;
};

export function renderWithProviders(ui: ReactNode, options?: RenderOptions) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <SessionProvider session={options?.session ?? null}>
      <AppThemeProvider>
        <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
      </AppThemeProvider>
    </SessionProvider>,
  );
}

function setAuthStorage(email: string, provider: "google" | "github" | "discord") {
  const token = `tf_${provider}_test`;
  const expiry = String(Date.now() + 60_000);

  window.localStorage.setItem(AUTH_PROVIDER_KEY, provider);
  window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
  window.localStorage.setItem(ACCESS_TOKEN_EXPIRY_KEY, expiry);
  window.localStorage.setItem(
    USER_PROFILE_KEY,
    JSON.stringify({ email, provider }),
  );
}

export function loginAsAdmin() {
  setAuthStorage("admin@test.threadforge.dev", "google");
}

export function loginAsUser() {
  setAuthStorage("user@test.threadforge.dev", "google");
}

export function createMockRequest(url: string, init?: RequestInit) {
  return new Request(url, init);
}

export async function createTestUser(params: {
  email: string;
  name?: string;
  isAdmin?: boolean;
}) {
  const { UserProfileModel } = await import("@/app/_lib/models/UserProfile");

  const created = await UserProfileModel.create({
    email: params.email.toLowerCase(),
    name: params.name ?? "Integration User",
    isAdmin: Boolean(params.isAdmin),
    provider: "google",
  });

  return created;
}

export async function seedDatabase() {
  const dbHelpers = await import("@/tests/setup/setupDb");
  return dbHelpers.seedDatabase();
}

export async function cleanupDatabase() {
  const dbHelpers = await import("@/tests/setup/setupDb");
  return dbHelpers.cleanupDatabase();
}

export async function waitForLoading(assertion: () => void | Promise<void>) {
  await waitFor(async () => {
    await assertion();
  });
}

export function mockServerAction<TArgs extends unknown[], TResult>(
  implementation: (...args: TArgs) => Promise<TResult>,
) {
  return vi.fn(implementation);
}
