"use client";

import { useEffect, useRef } from "react";
import { logoutAction } from "@/lib/auth-actions";

const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"] as const;

// Signs the user out after `timeoutMinutes` of no interaction anywhere in
// the dashboard. Session cookies otherwise last 30 days regardless of
// activity, which is fine for "remember me" but leaves an unlocked
// dashboard open indefinitely on a shared or unattended machine.
export function IdleLogout({ timeoutMinutes }: { timeoutMinutes: number }) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!timeoutMinutes || timeoutMinutes <= 0) return;

    const timeoutMs = timeoutMinutes * 60 * 1000;

    function resetTimer() {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        logoutAction();
      }, timeoutMs);
    }

    resetTimer();
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, resetTimer, { passive: true }));

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [timeoutMinutes]);

  return null;
}
