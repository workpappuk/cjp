"use client";

import { ThemeProvider } from "../_context/theme-context";

export default function Providers({ children }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}
