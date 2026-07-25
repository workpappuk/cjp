"use client";

import { ThemeProvider } from "./theme-context";

export default function Providers({ children }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}
