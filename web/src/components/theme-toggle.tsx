"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

const THEME_EVENT = "tedmark-theme-change";

function subscribe(callback: () => void) {
  window.addEventListener(THEME_EVENT, callback);
  return () => window.removeEventListener(THEME_EVENT, callback);
}

function getSnapshot() {
  return document.documentElement.classList.contains("dark");
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
        localStorage.setItem("tedmark-theme", next ? "dark" : "light");
        window.dispatchEvent(new Event(THEME_EVENT));
      }}
      className="text-ink-secondary hover:text-brand transition-all active:scale-95"
    >
      {isDark ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
}
