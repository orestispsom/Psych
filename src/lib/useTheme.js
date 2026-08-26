import { useCallback, useEffect, useState } from "react";

const KEY = "psych_theme";

function normalizeTheme(value) {
  return value === "dark" ? "dark" : "light";
}

function readStored() {
  try {
    const value = window.localStorage.getItem(KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

/**
 * Theme belongs to the active study profile. The local key remains a fallback
 * for the profile picker and for installations without online profile sync.
 */
export function useTheme(profileTheme = "light", onThemeChange) {
  const [theme, setTheme] = useState(() => normalizeTheme(profileTheme || readStored()));

  useEffect(() => {
    setTheme(normalizeTheme(profileTheme));
  }, [profileTheme]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      window.localStorage.setItem(KEY, theme);
    } catch {
      /* storage unavailable — the in-memory theme still applies */
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    onThemeChange?.(next);
  }, [onThemeChange, theme]);

  return { theme, toggleTheme };
}

export default useTheme;
