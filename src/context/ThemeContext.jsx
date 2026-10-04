import { createContext, useContext, useEffect, useState } from "react";
const ThemeCtx = createContext(null);
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem("amal-theme") || "dark"; } catch { return "dark"; } });
  useEffect(() => {
    const el = document.documentElement;
    el.classList.add("app"); el.classList.remove("theme-dark", "theme-light"); el.classList.add(`theme-${theme}`);
    try { localStorage.setItem("amal-theme", theme); } catch { /* ignore */ }
  }, [theme]);
  return <ThemeCtx.Provider value={{ theme, toggle: () => setTheme((t) => (t === "dark" ? "light" : "dark")) }}>{children}</ThemeCtx.Provider>;
}
export const useTheme = () => useContext(ThemeCtx);
