"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "@/app/_utils/auth";

type UseSignInRedirectOptions = {
  status: "loading" | "authenticated" | "unauthenticated";
  onBeforeRedirect?: (reason: string) => void;
};

export function useSignInRedirect({ status, onBeforeRedirect }: UseSignInRedirectOptions) {
  const router = useRouter();

  const requiresSignIn = useMemo(
    () => status === "unauthenticated" && !isAuthenticated(),
    [status],
  );

  const promptSignIn = useCallback(
    (reason: string) => {
      onBeforeRedirect?.(reason);
      const callbackUrl = `${window.location.pathname}${window.location.search}`;
      router.push(`/?callbackUrl=${encodeURIComponent(callbackUrl)}`);
    },
    [onBeforeRedirect, router],
  );

  return {
    requiresSignIn,
    promptSignIn,
  };
}