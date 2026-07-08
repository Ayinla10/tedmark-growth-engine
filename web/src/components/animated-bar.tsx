"use client";

import { motion } from "framer-motion";

export function AnimatedBar({
  widthPercent,
  className,
  delay = 0,
}: {
  widthPercent: number;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      className={`h-full rounded-full ${className ?? ""}`}
      initial={{ width: 0 }}
      animate={{ width: `${widthPercent}%` }}
      transition={{ duration: 0.7, delay, ease: "easeOut" }}
    />
  );
}
