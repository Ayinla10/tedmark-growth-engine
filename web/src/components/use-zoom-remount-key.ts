"use client";

import { useEffect, useState } from "react";

// Chromium page zoom (Ctrl +/-, pinch-zoom) rescales the whole composited
// frame without changing any element's CSS layout size — that's why plain
// content (text, borders, percentage-based boxes) appears to "zoom" along
// with the page for free. But a subtree with lots of continuously-running
// animations (like the orchestration canvas: robots, connectors, the
// JARVIS core all animating in infinite loops) gets promoted to its own
// GPU compositing layer, and Chromium has a long-standing bug where that
// independently-composited layer can get stuck at its previously-rasterized
// resolution instead of rescaling with the rest of the page.
//
// `visualViewport`'s `resize` event fires specifically when the browser's
// zoom *scale* changes (unlike `window`'s `resize`, which is mostly about
// actual viewport dimension changes). We use it to bump a counter that's
// passed as a `key` on the animated subtree, forcing a full unmount/remount
// — which guarantees Chromium creates a fresh compositing layer at the
// correct scale, sidestepping the stale-layer bug entirely.
export function useZoomRemountKey(): number {
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    const bump = () => setNonce((n) => n + 1);
    vv?.addEventListener("resize", bump);
    window.addEventListener("resize", bump);
    return () => {
      vv?.removeEventListener("resize", bump);
      window.removeEventListener("resize", bump);
    };
  }, []);

  return nonce;
}
