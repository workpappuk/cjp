"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Script from "next/script";
import { signIn, useSession } from "next-auth/react";

type GoogleCredentialResponse = {
  credential?: string;
};

type GoogleAccountsIdApi = {
  initialize: (options: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    auto_select?: boolean;
  }) => void;
  renderButton: (
    parent: HTMLElement,
    options: {
      theme?: "outline" | "filled_blue" | "filled_black";
      size?: "large" | "medium" | "small";
      text?: "signin_with" | "signup_with" | "continue_with" | "signin";
      shape?: "rectangular" | "pill" | "circle" | "square";
      width?: number;
    },
  ) => void;
  prompt: () => void;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: GoogleAccountsIdApi;
      };
    };
  }
}

export default function GoogleTopRightSignIn() {
  const { status } = useSession();
  const buttonContainerRef = useRef<HTMLDivElement | null>(null);
  const hasInitializedRef = useRef(false);
  const [isScriptReady, setIsScriptReady] = useState(false);
  const clientId = useMemo(
    () => process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "",
    [],
  );

  useEffect(() => {
    if (
      status !== "unauthenticated" ||
      !isScriptReady ||
      !clientId ||
      !window.google ||
      !buttonContainerRef.current
    ) {
      return;
    }

    if (hasInitializedRef.current) {
      return;
    }

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: async (response) => {
        if (!response.credential) {
          return;
        }

        await signIn("google-one-tap", {
          credential: response.credential,
          callbackUrl: "/pages/home",
        });
      },
      auto_select: true,
    });

    window.google.accounts.id.renderButton(buttonContainerRef.current, {
      theme: "outline",
      size: "large",
      text: "continue_with",
      shape: "pill",
      width: 240,
    });

    window.google.accounts.id.prompt();
    hasInitializedRef.current = true;
  }, [clientId, isScriptReady, status]);

  if (status === "authenticated") {
    return null;
  }

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => setIsScriptReady(true)}
      />
      <div className="fixed right-4 top-4 z-50 rounded-2xl border border-slate-200 bg-white/95 px-3 py-3 shadow-lg backdrop-blur sm:right-6 sm:top-6">
        {clientId ? (
          <div ref={buttonContainerRef} id="g_id_signin" />
        ) : (
          <button
            type="button"
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800"
            onClick={() => void signIn("google", { callbackUrl: "/pages/home" })}
          >
            Continue with Google
          </button>
        )}
      </div>
    </>
  );
}
