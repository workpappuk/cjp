import type { Theme } from "@/app/_context/theme-context";

export type MtwAccentColor = "orange" | "green" | "blue";

export type ThemeAccentClasses = {
  section: string;
  sectionBorder: string;
  link: string;
  title: string;
  heading: string;
  activePill: string;
  cardHover: string;
  softBadge: string;
};

export type ThemeToggleClasses = {
  on: string;
  ring: string;
};

export type ThemeColorTokens = {
  buttonColor: MtwAccentColor;
  accent: ThemeAccentClasses;
  toggle: ThemeToggleClasses;
};

const THEME_COLOR_TOKENS: Record<Theme, ThemeColorTokens> = {
  orange: {
    buttonColor: "orange",
    toggle: {
      on: "bg-orange-500",
      ring: "focus-visible:ring-orange-300",
    },
    accent: {
      section: "border-orange-200/80 dark:border-orange-800/80",
      sectionBorder: "border-orange-200/80 dark:border-orange-800/80",
      link: "text-orange-800 hover:bg-orange-50 dark:text-orange-300 dark:hover:bg-slate-800",
      title: "text-orange-900 dark:text-orange-200",
      heading: "text-orange-900 dark:text-orange-200",
      activePill: "border-orange-300 bg-orange-100 text-orange-900 dark:border-orange-700 dark:bg-orange-900/30 dark:text-orange-200",
      cardHover: "hover:border-orange-300 dark:hover:border-orange-700",
      softBadge: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-700 dark:bg-orange-900/30 dark:text-orange-200",
    },
  },
  emerald: {
    buttonColor: "green",
    toggle: {
      on: "bg-emerald-500",
      ring: "focus-visible:ring-emerald-300",
    },
    accent: {
      section: "border-emerald-200/80 dark:border-emerald-800/80",
      sectionBorder: "border-emerald-200/80 dark:border-emerald-800/80",
      link: "text-emerald-800 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-slate-800",
      title: "text-emerald-900 dark:text-emerald-200",
      heading: "text-emerald-900 dark:text-emerald-200",
      activePill: "border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200",
      cardHover: "hover:border-emerald-300 dark:hover:border-emerald-700",
      softBadge: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200",
    },
  },
  sky: {
    buttonColor: "blue",
    toggle: {
      on: "bg-blue-500",
      ring: "focus-visible:ring-blue-300",
    },
    accent: {
      section: "border-sky-200/80 dark:border-sky-800/80",
      sectionBorder: "border-sky-200/80 dark:border-sky-800/80",
      link: "text-sky-800 hover:bg-sky-50 dark:text-sky-300 dark:hover:bg-slate-800",
      title: "text-sky-900 dark:text-sky-200",
      heading: "text-sky-900 dark:text-sky-200",
      activePill: "border-sky-300 bg-sky-100 text-sky-900 dark:border-sky-700 dark:bg-sky-900/30 dark:text-sky-200",
      cardHover: "hover:border-sky-300 dark:hover:border-sky-700",
      softBadge: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-700 dark:bg-sky-900/30 dark:text-sky-200",
    },
  },
};

export function getThemeColorTokens(theme: Theme): ThemeColorTokens {
  return THEME_COLOR_TOKENS[theme] ?? THEME_COLOR_TOKENS.orange;
}
