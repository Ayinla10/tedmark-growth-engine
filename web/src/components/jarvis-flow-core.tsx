"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import type { LottieRefCurrentProps } from "lottie-react";
import animationData from "@/assets/jarvis-flow.json";

// lottie-web touches `document` at module scope, so the player must only
// load in the browser.
const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

// The central "brain" of the orchestration canvas: the user-provided JARVIS
// flow animation, fluid-sized so it scales with the canvas around it.
export function JarvisFlowCore({ size }: { size?: number }) {
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
    // Padding-percentage technique, not the `aspect-ratio` CSS property: a
    // container sized with `aspect-ratio` that holds an SVG child (a
    // replaced element, which is what Lottie renders) has a Chromium quirk
    // where the resolved intrinsic size gets cached and never re-resolves
    // on pure browser zoom, freezing the animation at its first-rendered
    // pixel size while the rest of the page zooms normally.
    <div
      ref={containerRef}
      style={size ? { width: size, height: size, position: "relative" } : { width: "100%", position: "relative", paddingTop: "100%" }}
    >
      <div
        className="absolute inset-0 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(56,189,248,0.16) 0%, rgba(56,189,248,0.05) 45%, transparent 70%)" }}
      />
      <Lottie
        lottieRef={lottieRef}
        animationData={animationData}
        loop
        autoplay
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      />
    </div>
  );
}
