"use client";

import { createContext, useContext, useState, useEffect } from "react";

type ThemeId = "default" | "blue-wave" | "green-wave" | "valheim";

const ThemeContext = createContext<{
  theme: ThemeId;
  setTheme: (t: ThemeId) => void;
}>({ theme: "default", setTheme: () => {} });

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>("default");

  useEffect(() => {
    const saved = localStorage.getItem("pa-theme") as ThemeId | null;
    if (saved) {
      setThemeState(saved);
      applyThemeClass(saved);
    }
  }, []);

  function setTheme(t: ThemeId) {
    setThemeState(t);
    localStorage.setItem("pa-theme", t);
    applyThemeClass(t);
  }

  function applyThemeClass(t: ThemeId) {
    const html = document.documentElement;
    html.classList.remove("theme-blue-wave", "theme-green-wave", "theme-valheim");
    if (t === "blue-wave") html.classList.add("theme-blue-wave");
    if (t === "green-wave") html.classList.add("theme-green-wave");
    if (t === "valheim") html.classList.add("theme-valheim");
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
