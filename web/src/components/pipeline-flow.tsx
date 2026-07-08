"use client";

import { Bot } from "lucide-react";
import { motion } from "framer-motion";
import type { ComponentType } from "react";

type PipelineNode = {
  label: string;
  active: boolean;
  activeClasses: string; // tailwind bg/text/border classes when active
  dotClass: string; // solid tailwind bg class for the traveling bot dot
  Icon: ComponentType<{ active?: boolean; size?: number; className?: string }>;
};

export function PipelineFlow({ nodes }: { nodes: PipelineNode[] }) {
  return (
    <div className="flex items-center gap-1 mt-6">
      {nodes.map((node, i) => (
        <div key={node.label} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center gap-1.5 shrink-0">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center border transition-colors ${
                node.active ? node.activeClasses : "bg-surface-2 border-border-c text-ink-muted"
              }`}
            >
              <node.Icon active={node.active} size={20} />
            </div>
            <span className="text-[11px] font-medium text-ink-secondary whitespace-nowrap">{node.label}</span>
          </div>

          {i < nodes.length - 1 && (
            <div className="relative flex-1 h-px mx-1 mb-5 min-w-[24px] bg-border-c">
              {node.active && nodes[i + 1].active ? (
                <motion.div
                  className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center text-white shadow-lg ${node.dotClass}`}
                  animate={{ left: ["0%", "88%"] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                >
                  <Bot size={11} />
                </motion.div>
              ) : null}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
