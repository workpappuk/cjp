"use client";

import { type PropsWithChildren, useMemo } from "react";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider as MaterialThemeProvider } from "@material-tailwind/react";
import { ThemeProvider as AppThemeProvider, useTheme } from "@/app/_context/theme-context";
import { createMaterialTheme } from "@/app/_context/material-theme";
import AuthSessionSync from "@/app/_components/AuthSessionSync";

function MaterialThemeBridge({ children }: PropsWithChildren) {
  const { theme } = useTheme();
  const materialTheme = useMemo(() => createMaterialTheme(theme), [theme]);

  return <MaterialThemeProvider value={materialTheme}>{children}</MaterialThemeProvider>;
}

export default function Providers({ children }: PropsWithChildren) {
  return (
    <SessionProvider>
      <AppThemeProvider>
        <MaterialThemeBridge>
          <AuthSessionSync />
          {children}
        </MaterialThemeBridge>
      </AppThemeProvider>
    </SessionProvider>
  );
}
