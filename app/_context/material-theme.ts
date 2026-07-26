import type { Theme } from "@/app/_context/theme-context";

const accentColorByTheme: Record<Theme, "orange" | "green" | "blue"> = {
  orange: "orange",
  emerald: "green",
  sky: "blue",
};

export function createMaterialTheme(theme: Theme) {
  const accentColor = accentColorByTheme[theme] ?? "orange";

  return {
    button: {
      defaultProps: {
        ripple: true,
        color: accentColor,
        className: "normal-case tracking-normal font-semibold",
      },
      valid: {
        colors: [
          "white",
          "black",
          "blue-gray",
          "gray",
          "brown",
          "deep-orange",
          "orange",
          "amber",
          "yellow",
          "lime",
          "light-green",
          "green",
          "teal",
          "cyan",
          "light-blue",
          "blue",
          "indigo",
          "deep-purple",
          "purple",
          "pink",
          "red",
        ],
      },
    },
    iconButton: {
      defaultProps: {
        color: accentColor,
      },
    },
    card: {
      styles: {
        base: {
          initial: {
            borderRadius: "rounded-xl",
          },
        },
      },
    },
    typography: {
      defaultProps: {
        color: "blue-gray",
      },
    },
    input: {
      defaultProps: {
        color: accentColor,
        labelProps: {
          className: "text-slate-600 dark:text-slate-300",
        },
      },
    },
    select: {
      defaultProps: {
        color: accentColor,
        menuProps: {
          className: "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200",
        },
      },
    },
    chip: {
      defaultProps: {
        color: accentColor,
        className: "rounded-full",
      },
    },
  } as const;
}
