"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";

const THEME_EVENT = "tedmark-theme-change";

function subscribe(callback: () => void) {
  window.addEventListener(THEME_EVENT, callback);
  return () => window.removeEventListener(THEME_EVENT, callback);
}

function getSnapshot() {
  const el = document.documentElement;
  if (el.classList.contains("dark")) return true;
  if (el.classList.contains("light")) return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function getServerSnapshot() {
  return false;
}

const emptySubscribe = () => () => {};

function useHasMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

export function ThemeToggle() {
  const mounted = useHasMounted();
  const isDark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    const stored = localStorage.getItem("tedmark-theme");
    const el = document.documentElement;
    el.classList.remove("light", "dark");
    if (stored === "light") {
      el.classList.add("light");
    } else {
      el.classList.add("dark");
      localStorage.setItem("tedmark-theme", "dark");
    }
    window.dispatchEvent(new Event(THEME_EVENT));
  }, []);

  if (!mounted) {
    return <div className="h-5 w-5" aria-hidden="true" />;
  }

  return (
    <button
      type="button"
      aria-label="Toggle color theme"
      onClick={() => {
        const next = !isDark;
        document.documentElement.classList.toggle("dark", next);
        document.documentElement.classList.toggle("light", !next);
        localStorage.setItem("tedmark-theme", next ? "dark" : "light");
        window.dispatchEvent(new Event(THEME_EVENT));
      }}
      className="text-ink-secondary hover:text-brand transition-all active:scale-95"
    >
      {isDark ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
}
