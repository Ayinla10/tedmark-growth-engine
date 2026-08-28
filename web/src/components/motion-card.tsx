"use client";

import { motion } from "framer-motion";
import type { CSSProperties, ReactNode } from "react";

export function MotionCard({
  index = 0,
  className,
  style,
  children,
}: {
  index?: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08, ease: "easeOut" }}
      whileHover={{ y: -4 }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
}
