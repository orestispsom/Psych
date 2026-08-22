import { useCallback, useEffect, useState } from "react";

const KEY = "psych_theme";

function readStored() {
  try {
    const value = window.localStorage.getItem(KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

/**
 * Dark is the default: the dominant use scene is evening and night revision
 * after clinical duty. Light is the same instrument in positive, for daytime
 * desk study.
 */
export function useTheme() {
  const [theme, setTheme] = useState(() => readStored() || "dark");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      window.localStorage.setItem(KEY, theme);
    } catch {
      /* storage unavailable — the in-memory theme still applies */
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(current => (current === "dark" ? "light" : "dark"));
  }, []);

  return { theme, toggleTheme };
}

export default useTheme;
