"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import {
  ACCESS_TOKEN_EXPIRY_KEY,
  ACCESS_TOKEN_KEY,
  AUTH_PROVIDER_KEY,
  USER_PROFILE_KEY,
  clearAuthSession,
} from "@/app/_utils/auth";

const TOKEN_TTL_MS = 1000 * 60 * 60 * 24;

export default function AuthSessionSync() {
  const { data, status } = useSession();

  useEffect(() => {
    if (status === "loading") {
      return;
    }

    if (status !== "authenticated" || !data?.accessToken) {
      clearAuthSession();
      return;
    }

    window.localStorage.setItem(AUTH_PROVIDER_KEY, data.provider ?? "google");
    window.localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
    window.localStorage.setItem(
      ACCESS_TOKEN_EXPIRY_KEY,
      String(Date.now() + TOKEN_TTL_MS),
    );
    window.localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(data.user ?? {}));
  }, [data?.accessToken, data?.provider, status]);

  return null;
}
