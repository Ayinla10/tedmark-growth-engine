"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import type { LottieRefCurrentProps } from "lottie-react";
import animationData from "@/assets/jarvis-circle.json";

// lottie-web touches `document` at module scope, so the player must only
// load in the browser.
const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

export function JarvisLottie({ size }: { size?: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lottieRef = useRef<LottieRefCurrentProps | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // lottie-web bakes a fixed pixel width/height onto its internal <svg>
    // at load time and only recomputes on a `window.resize` event — which
    // browser zoom doesn't reliably fire. A ResizeObserver catches the
    // actual rendered size changing (including from zoom) and forces
    // lottie to recalculate, so the core scales in step with the rest of
    // the canvas instead of staying pinned at its original pixel size.
    const observer = new ResizeObserver(() => {
      lottieRef.current?.animationItem?.resize();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      style={size ? { width: size, height: size } : { width: "100%", aspectRatio: "1 / 1" }}
      className="relative"
    >
      <div
        className="absolute inset-0 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(251,191,36,0.14) 0%, rgba(251,191,36,0.04) 45%, transparent 70%)" }}
      />
      <Lottie
        lottieRef={lottieRef}
        animationData={animationData}
        loop
        autoplay
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}
