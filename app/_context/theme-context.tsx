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
const COLOR_MODE_KEY = "threadforge-color-mode";
const VALID_THEMES = ["orange", "emerald", "sky"] as const;
export type Theme = (typeof VALID_THEMES)[number];
const VALID_COLOR_MODES = ["system", "light", "dark"] as const;
export type ColorMode = (typeof VALID_COLOR_MODES)[number];

type ThemeContextValue = {
  theme: Theme;
  setTheme: (nextTheme: string) => void;
  colorMode: ColorMode;
  setColorMode: (nextMode: string) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isValidTheme(value: string): value is Theme {
  return VALID_THEMES.includes(value as Theme);
}

function isValidColorMode(value: string): value is ColorMode {
  return VALID_COLOR_MODES.includes(value as ColorMode);
}

function applyDocumentMode(mode: ColorMode) {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const useDark = mode === "dark" || (mode === "system" && prefersDark);

  root.classList.toggle("dark", useDark);
  root.style.colorScheme = useDark ? "dark" : "light";
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") {
      return "orange";
    }

    const storedTheme = window.localStorage.getItem(THEME_KEY);
    return storedTheme && isValidTheme(storedTheme) ? storedTheme : "orange";
  });
  const [colorMode, setColorModeState] = useState<ColorMode>(() => {
    if (typeof window === "undefined") {
      return "system";
    }

    const storedMode = window.localStorage.getItem(COLOR_MODE_KEY);
    return storedMode && isValidColorMode(storedMode) ? storedMode : "system";
  });

  const setTheme = useCallback((nextTheme: string) => {
    setThemeState(isValidTheme(nextTheme) ? nextTheme : "orange");
  }, []);

  const setColorMode = useCallback((nextMode: string) => {
    setColorModeState(isValidColorMode(nextMode) ? nextMode : "system");
  }, []);

  useEffect(() => {
    window.localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem(COLOR_MODE_KEY, colorMode);
    applyDocumentMode(colorMode);

    if (colorMode !== "system") {
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onMediaChange = () => applyDocumentMode("system");
    media.addEventListener("change", onMediaChange);

    return () => {
      media.removeEventListener("change", onMediaChange);
    };
  }, [colorMode]);

  const contextValue = useMemo(
    () => ({ theme, setTheme, colorMode, setColorMode }),
    [theme, setTheme, colorMode, setColorMode],
  );

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
