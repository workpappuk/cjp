"use client";

import { useEffect, useRef } from "react";
import { signIn, useSession } from "next-auth/react";

export default function GoogleTopRightSignIn() {
  const { status } = useSession();
  const hasTriggeredAutoOpenRef = useRef(false);

  useEffect(() => {
    if (status !== "unauthenticated") {
      return;
    }

    if (hasTriggeredAutoOpenRef.current) {
      return;
    }

    hasTriggeredAutoOpenRef.current = true;
    void signIn("google", { callbackUrl: "/pages/home" });
  }, [status]);

  if (status === "authenticated") {
    return null;
  }

  return (
    <div className="fixed right-4 top-4 z-50 rounded-2xl border border-slate-200 bg-white/95 px-3 py-3 shadow-lg backdrop-blur sm:right-6 sm:top-6">
      <button
        type="button"
        className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-slate-400"
        onClick={() => void signIn("google", { callbackUrl: "/pages/home" })}
      >
        Continue with Google
      </button>
    </div>
  );
}
