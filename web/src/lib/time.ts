function parseTs(raw: string): Date {
  const s = raw.replace(" ", "T");
  return new Date(/[Z+]/.test(s.slice(10)) ? s : s + "Z");
}

export function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const diffMs = Date.now() - parseTs(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function isRecent(iso: string | null, hours = 24): boolean {
  if (!iso) return false;
  return Date.now() - parseTs(iso).getTime() < hours * 60 * 60 * 1000;
}

export function toISODateString(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

export function formatDate(value: string | null): string {
  if (!value) return "—";
  // Postgres returns "2026-08-13 07:23:41.123" — replace space with T,
  // then append Z if no explicit timezone, so JS parses it as UTC.
  const s = String(value).replace(" ", "T");
  const iso = /[Z+]/.test(s.slice(10)) ? s : s + "Z";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Date only — no time — for date pickers / action-due fields */
export function formatDateOnly(value: string | null): string {
  if (!value) return "—";
  return new Date(String(value).slice(0, 10)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
