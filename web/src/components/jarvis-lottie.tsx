"use client";

import dynamic from "next/dynamic";
import animationData from "@/assets/jarvis-circle.json";

// lottie-web touches `document` at module scope, so the player must only
// load in the browser.
const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

export function JarvisLottie({ size }: { size?: number }) {
  return (
    <div
      style={size ? { width: size, height: size } : { width: "100%", aspectRatio: "1 / 1" }}
      className="relative"
    >
      <div
        className="absolute inset-0 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(251,191,36,0.14) 0%, rgba(251,191,36,0.04) 45%, transparent 70%)" }}
      />
      <Lottie animationData={animationData} loop autoplay style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
