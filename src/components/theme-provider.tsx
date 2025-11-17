import * as React from "react";

type Theme = "light" | "dark" | "system";

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeProviderContext = React.createContext<ThemeContextValue | undefined>(undefined);

const DEFAULT_STORAGE_KEY = "examify-theme";

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = DEFAULT_STORAGE_KEY,
}: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<Theme>(defaultTheme);

  // Initialize theme from localStorage or system preference
  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const storedTheme = window.localStorage.getItem(storageKey) as Theme | null;

    if (storedTheme === "light" || storedTheme === "dark" || storedTheme === "system") {
      setThemeState(storedTheme);
      return;
    }

    if (defaultTheme === "system") {
      setThemeState(getSystemTheme());
    } else {
      setThemeState(defaultTheme);
    }
  }, [defaultTheme, storageKey]);

  // Apply theme class to the document root
  React.useEffect(() => {
    if (typeof document === "undefined") return;

    const root = document.documentElement;
    const resolvedTheme = theme === "system" ? getSystemTheme() : theme;

    root.classList.remove("light", "dark");
    root.classList.add(resolvedTheme);
    root.setAttribute("data-theme", resolvedTheme);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, theme);
    }
  }, [theme, storageKey]);

  const setTheme = React.useCallback((value: Theme) => {
    setThemeState(value);
  }, []);

  const value = React.useMemo(
    () => ({
      theme,
      setTheme,
    }),
    [theme, setTheme],
  );

  return <ThemeProviderContext.Provider value={value}>{children}</ThemeProviderContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const context = React.useContext(ThemeProviderContext);

  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }

  return context;
}
