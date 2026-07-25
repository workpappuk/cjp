"use client";

import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const THEME_KEY = "threadforge-theme";
const VALID_THEMES = ["orange", "emerald", "sky"] as const;
export type Theme = (typeof VALID_THEMES)[number];

type ThemeContextValue = {
  theme: Theme;
  setTheme: (nextTheme: string) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isValidTheme(value: string): value is Theme {
  return VALID_THEMES.includes(value as Theme);
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const [theme, setThemeState] = useState<Theme>("orange");

  const setTheme = useCallback((nextTheme: string) => {
    setThemeState(isValidTheme(nextTheme) ? nextTheme : "orange");
  }, []);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(THEME_KEY);
    if (storedTheme && isValidTheme(storedTheme)) {
      setThemeState(storedTheme);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const contextValue = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return (
    <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
