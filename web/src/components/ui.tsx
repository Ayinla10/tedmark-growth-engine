"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { AnimatedNumber } from "./animated-number";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="flex items-center justify-between mb-8"
    >
      <div>
        <h2 className="text-2xl font-semibold text-ink">{title}</h2>
        {subtitle ? <p className="text-ink-secondary">{subtitle}</p> : null}
      </div>
      {actions}
    </motion.div>
  );
}

export function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) {
    return <span className="text-xs px-2 py-0.5 rounded-full bg-surface-2 text-ink-muted">—</span>;
  }
  const cls =
    score >= 8
      ? "bg-green-500/15 text-green-700 dark:text-green-400"
      : score >= 5
        ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
        : "bg-red-500/15 text-red-700 dark:text-red-400";
  return <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${cls}`}>{score}</span>;
}

// Maps every technical status value to a human-readable label + Tailwind colour classes.
// Add new mappings here — never render raw status strings in the UI.
const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  // Lead pipeline statuses
  raw:                  { label: "New",           cls: "bg-surface-2 text-ink-secondary" },
  new:                  { label: "New",           cls: "bg-surface-2 text-ink-secondary" },
  discovered:           { label: "New",           cls: "bg-surface-2 text-ink-secondary" },
  enriched:             { label: "Researched",    cls: "bg-blue-500/15 text-blue-700 dark:text-blue-400" },
  enrichment_complete:  { label: "Researched",    cls: "bg-blue-500/15 text-blue-700 dark:text-blue-400" },
  qualified:            { label: "Qualified",     cls: "bg-green-500/15 text-green-700 dark:text-green-400" },
  icp_scored:           { label: "Qualified",     cls: "bg-green-500/15 text-green-700 dark:text-green-400" },
  outreach_pending:     { label: "Contacted",     cls: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400" },
  contacted:            { label: "Contacted",     cls: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400" },
  sequence_active:      { label: "Following up",  cls: "bg-violet-500/15 text-violet-700 dark:text-violet-400" },
  replied:              { label: "Replied",       cls: "bg-teal-500/15 text-teal-700 dark:text-teal-400" },
  positive_reply:       { label: "Replied",       cls: "bg-teal-500/15 text-teal-700 dark:text-teal-400" },
  reply_received:       { label: "Replied",       cls: "bg-teal-500/15 text-teal-700 dark:text-teal-400" },
  proposal:             { label: "Proposal sent", cls: "bg-brand/15 text-brand" },
  proposal_sent:        { label: "Proposal sent", cls: "bg-brand/15 text-brand" },
  won:                  { label: "Won",           cls: "bg-green-500/15 text-green-700 dark:text-green-400" },
  closed_won:           { label: "Won",           cls: "bg-green-500/15 text-green-700 dark:text-green-400" },
  lost:                 { label: "Lost",          cls: "bg-red-500/15 text-red-700 dark:text-red-400" },
  closed_lost:          { label: "Lost",          cls: "bg-red-500/15 text-red-700 dark:text-red-400" },
  disqualified:         { label: "Not a fit",     cls: "bg-surface-2 text-ink-muted" },
  archived:             { label: "Not a fit",     cls: "bg-surface-2 text-ink-muted" },
  // Outreach / follow-up statuses
  draft:                { label: "Draft",         cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  approved:             { label: "Approved",      cls: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400" },
  sent:                 { label: "Sent",          cls: "bg-green-500/15 text-green-700 dark:text-green-400" },
  pending:              { label: "Pending",       cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  skipped:              { label: "Skipped",       cls: "bg-surface-2 text-ink-muted" },
};

export function StatusBadge({ status }: { status: string }) {
  const entry = STATUS_MAP[status];
  const label = entry?.label ?? status;
  const cls = entry?.cls ?? "bg-surface-2 text-ink-secondary";
  return <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${cls}`}>{label}</span>;
}

export function Card({ children, className = "", index = 0 }: { children: ReactNode; className?: string; index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05, ease: "easeOut" }}
      className={`card-shadow bg-surface border border-border-c rounded-2xl ${className}`}
    >
      {children}
    </motion.div>
  );
}

export function KpiCard({ label, value, hint, index = 0 }: { label: string; value: string | number; hint?: string; index?: number }) {
  const numeric = typeof value === "number";
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05, ease: "easeOut" }}
      className="card-shadow bg-surface border border-border-c rounded-2xl p-4"
    >
      <p className="text-xs text-ink-muted mb-1">{label}</p>
      {numeric ? (
        <AnimatedNumber value={value as number} className="text-2xl font-semibold text-ink" />
      ) : (
        <p className="text-2xl font-semibold text-ink">{value}</p>
      )}
      {hint ? <p className="text-xs text-ink-muted mt-1">{hint}</p> : null}
    </motion.div>
  );
}

export function Th({ children }: { children?: ReactNode }) {
  return (
    <th className="px-4 py-2.5 text-left text-xs font-medium text-ink-secondary whitespace-nowrap">
      {children}
    </th>
  );
}

export function Td({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`px-4 py-2.5 text-sm text-ink ${className}`}>{children}</td>;
}

export function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="text-center py-16"
    >
      <p className="text-ink font-medium">{title}</p>
      <p className="text-sm text-ink-muted mt-1">{hint}</p>
    </motion.div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description = "An unexpected error occurred. Please try again.",
  retry,
}: {
  title?: string;
  description?: string;
  retry?: () => void;
}) {
  return (
    <div className="text-center py-16 px-6">
      <p className="text-ink font-semibold mb-1">{title}</p>
      <p className="text-sm text-ink-muted mb-4">{description}</p>
      {retry && (
        <button
          onClick={retry}
          className="text-xs font-semibold px-4 py-2 rounded-lg"
          style={{ background: "var(--brand)", color: "#fff" }}
        >
          Try again
        </button>
      )}
    </div>
  );
}

export function LoadingSkeleton({ rows = 3, className = "" }: { rows?: number; className?: string }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-10 rounded-xl animate-pulse"
          style={{ background: "var(--surface-2)", opacity: 1 - i * 0.15 }}
        />
      ))}
    </div>
  );
}

export function NextBestAction({
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  why,
}: {
  title: string;
  description: string;
  actionLabel: string;
  actionHref?: string;
  onAction?: () => void;
  why?: string;
}) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: "rgba(107,159,255,0.06)", border: "1px solid rgba(107,159,255,0.2)" }}
    >
      <p className="text-[10px] font-semibold tracking-[0.15em] uppercase mb-2" style={{ color: "var(--brand)" }}>
        Next best action
      </p>
      <p className="text-sm font-semibold mb-1" style={{ color: "var(--ink)" }}>{title}</p>
      <p className="text-sm mb-3" style={{ color: "var(--ink-secondary)" }}>{description}</p>
      {why && (
        <p className="text-xs mb-3 italic" style={{ color: "var(--ink-muted)" }}>Why: {why}</p>
      )}
      {actionHref ? (
        <a
          href={actionHref}
          className="inline-flex items-center text-xs font-semibold px-3 py-1.5 rounded-lg"
          style={{ background: "var(--brand)", color: "#fff" }}
        >
          {actionLabel}
        </a>
      ) : onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center text-xs font-semibold px-3 py-1.5 rounded-lg"
          style={{ background: "var(--brand)", color: "#fff" }}
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

export function AIRecommendation({
  recommendation,
  evidence,
  actionLabel,
  actionHref,
}: {
  recommendation: string;
  evidence: string[];
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: "rgba(107,159,255,0.04)", border: "1px solid rgba(107,159,255,0.15)" }}
    >
      <p className="text-[10px] font-semibold tracking-[0.15em] uppercase mb-2" style={{ color: "var(--brand)" }}>
        AI recommendation
      </p>
      <p className="text-sm font-medium mb-2" style={{ color: "var(--ink)" }}>{recommendation}</p>
      {evidence.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-medium mb-1" style={{ color: "var(--ink-muted)" }}>Why:</p>
          <ul className="space-y-0.5">
            {evidence.map((e, i) => (
              <li key={i} className="text-xs" style={{ color: "var(--ink-secondary)" }}>
                · {e}
              </li>
            ))}
          </ul>
        </div>
      )}
      {actionLabel && actionHref && (
        <a
          href={actionHref}
          className="inline-flex items-center text-xs font-semibold px-3 py-1.5 rounded-lg"
          style={{ background: "var(--brand)", color: "#fff" }}
        >
          {actionLabel}
        </a>
      )}
    </div>
  );
}

export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <p className="text-sm font-semibold text-ink">{title}</p>
        {description && <p className="text-xs text-ink-muted mt-0.5">{description}</p>}
      </div>
      {action}
    </div>
  );
}

