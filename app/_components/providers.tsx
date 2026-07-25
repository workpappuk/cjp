"use client";

import type { PropsWithChildren } from "react";
import { ThemeProvider } from "@/app/_context/theme-context";

export default function Providers({ children }: PropsWithChildren) {
  return <ThemeProvider>{children}</ThemeProvider>;
}
