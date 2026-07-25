"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const THEME_KEY = "threadforge-theme";
const VALID_THEMES = ["orange", "emerald", "sky"];

const ThemeContext = createContext(null);

function isValidTheme(value) {
  return VALID_THEMES.includes(value);
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState("orange");

  const setTheme = useCallback((nextTheme) => {
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
