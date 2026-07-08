"use client";

import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import type { CSSProperties } from "react";
import { useEffect } from "react";

export function AnimatedNumber({ value, className, style }: { value: number; className?: string; style?: CSSProperties }) {
  const motionValue = useMotionValue(0);
  const rounded = useTransform(motionValue, (v) => Math.round(v).toLocaleString());

  useEffect(() => {
    const controls = animate(motionValue, value, { duration: 0.8, ease: "easeOut" });
    return () => controls.stop();
  }, [value, motionValue]);

  return <motion.span className={className} style={style}>{rounded}</motion.span>;
}
