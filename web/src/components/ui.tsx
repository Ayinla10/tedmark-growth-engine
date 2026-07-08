import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-8">
      <div>
        <h2 className="text-2xl font-semibold text-ink">{title}</h2>
        {subtitle ? <p className="text-ink-secondary">{subtitle}</p> : null}
      </div>
      {actions}
    </div>
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

const STATUS_STYLES: Record<string, string> = {
  raw: "bg-surface-2 text-ink-secondary",
  qualified: "bg-green-500/15 text-green-700 dark:text-green-400",
  contacted: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  archived: "bg-surface-2 text-ink-muted",
  draft: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  approved: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  sent: "bg-green-500/15 text-green-700 dark:text-green-400",
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  skipped: "bg-surface-2 text-ink-muted",
};

export function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLES[status] ?? "bg-surface-2 text-ink-secondary";
  return <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full capitalize ${cls}`}>{status}</span>;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-surface border border-border-c rounded-2xl ${className}`}>{children}</div>
  );
}

export function KpiCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="bg-surface border border-border-c rounded-2xl p-4">
      <p className="text-xs text-ink-muted mb-1">{label}</p>
      <p className="text-2xl font-semibold text-ink">{value}</p>
      {hint ? <p className="text-xs text-ink-muted mt-1">{hint}</p> : null}
    </div>
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
    <div className="text-center py-16">
      <p className="text-ink font-medium">{title}</p>
      <p className="text-sm text-ink-muted mt-1">{hint}</p>
    </div>
  );
}

export function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
