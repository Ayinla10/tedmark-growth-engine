"use client";

import { motion } from "framer-motion";
import Image from "next/image";

export type AgentColorKey = "scout" | "qualifier" | "outreach" | "sequencer" | "proposal" | "analytics";

type RobotProps = {
  active: boolean;
  color: string;
  /** Fill the parent width instead of a fixed pixel size, keeping a 1:1 aspect. */
  fluid?: boolean;
  size?: number;
};

// The user-supplied 3D robot render, hovering over a colored neon platform
// disc. One shared image is re-tinted per agent via a colored glow/ring
// rather than pixel-editing the source art.
export function RobotAgent({ active, color, fluid = false, size = 120 }: RobotProps) {
  return (
    // Padding-percentage technique instead of the `aspect-ratio` CSS
    // property: a container sized with `aspect-ratio` that holds an <img>
    // (a replaced element) has a Chromium quirk where the resolved
    // intrinsic size gets cached and never re-resolves on pure browser
    // zoom, freezing the robot at its first-rendered pixel size.
    <div
      className="relative"
      style={fluid ? { width: "100%", paddingTop: "100%" } : { width: size, height: size }}
    >
      <div className="absolute inset-0 flex items-end justify-center">
        {/* Platform disc */}
        <motion.div
          className="absolute bottom-[6%] w-[74%] h-[16%] rounded-[50%] border"
          style={{ borderColor: `${color}88`, boxShadow: `0 0 ${active ? 22 : 8}px ${color}55` }}
          animate={active ? { opacity: [0.6, 1, 0.6] } : { opacity: 0.35 }}
          transition={active ? { duration: 2, repeat: Infinity, ease: "easeInOut" } : {}}
        />
        <div
          className="absolute bottom-[3%] w-[86%] h-[10%] rounded-[50%]"
          style={{ background: `radial-gradient(ellipse, ${color}33 0%, transparent 70%)` }}
        />

        {/* Robot */}
        <motion.div
          className="relative w-[78%] h-[86%]"
          animate={active ? { y: ["0%", "-6%", "0%"] } : { y: "0%" }}
          transition={active ? { duration: 2.6, repeat: Infinity, ease: "easeInOut" } : { duration: 0.3 }}
          style={{ filter: active ? `drop-shadow(0 0 14px ${color}88) saturate(1.15)` : "saturate(0.7) brightness(0.85)" }}
        >
          <Image src="/agents/robot.webp" alt="" fill sizes="200px" className="object-contain" priority />
        </motion.div>
      </div>
    </div>
  );
}
