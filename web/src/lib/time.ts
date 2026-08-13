function parseTs(raw: string | Date): Date {
  if (raw instanceof Date) return raw;
  // Postgres string: "2026-08-13 07:23:41.123" — normalize to ISO UTC
  const s = raw.replace(" ", "T");
  return new Date(/[Z+]/.test(s.slice(10)) ? s : s + "Z");
}

export function timeAgo(iso: string | Date | null): string {
  if (!iso) return "never";
  const diffMs = Date.now() - parseTs(iso as string | Date).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function isRecent(iso: string | Date | null, hours = 24): boolean {
  if (!iso) return false;
  return Date.now() - parseTs(iso as string | Date).getTime() < hours * 60 * 60 * 1000;
}

export function toISODateString(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

export function formatDate(value: string | Date | null): string {
  if (!value) return "—";
  return parseTs(value as string | Date).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Date only — no time — for date pickers / action-due fields */
export function formatDateOnly(value: string | Date | null): string {
  if (!value) return "—";
  return parseTs(value as string | Date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
