"use client";

import type { PropsWithChildren } from "react";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "@/app/_context/theme-context";
import AuthSessionSync from "@/app/_components/AuthSessionSync";

export default function Providers({ children }: PropsWithChildren) {
  return (
    <SessionProvider>
      <ThemeProvider>
        <AuthSessionSync />
        {children}
      </ThemeProvider>
    </SessionProvider>
  );
}
