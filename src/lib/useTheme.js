import { useCallback, useEffect, useState } from "react";

const KEY = "psych_theme";

function normalizeTheme(value) {
  return value === "dark" ? "dark" : "light";
}

function readStored() {
  try {
    const value = window.localStorage.getItem(KEY);
    if (value === "light" || value === "dark") return value;

    const rawProfiles = window.localStorage.getItem("psych_study_profiles_v1");
    if (rawProfiles) {
      const parsed = JSON.parse(rawProfiles);
      if (parsed?.activeProfileId && parsed?.profiles?.[parsed.activeProfileId]?.themePreference) {
        const pref = parsed.profiles[parsed.activeProfileId].themePreference;
        if (pref === "light" || pref === "dark") return pref;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Theme belongs to the active study profile. The local key remains a fallback
 * for the profile picker and for installations without online profile sync.
 */
export function useTheme(profileTheme, onThemeChange) {
  const [theme, setTheme] = useState(() => {
    return normalizeTheme(profileTheme || readStored() || "dark");
  });

  useEffect(() => {
    if (profileTheme === "dark" || profileTheme === "light") {
      setTheme(profileTheme);
    }
  }, [profileTheme]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.colorScheme = theme;
    try {
      window.localStorage.setItem(KEY, theme);
    } catch {
      /* storage unavailable — the in-memory theme still applies */
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    document.documentElement.style.colorScheme = next;
    try {
      window.localStorage.setItem(KEY, next);
    } catch {}
    onThemeChange?.(next);
  }, [onThemeChange, theme]);

  return { theme, toggleTheme };
}

export default useTheme;
