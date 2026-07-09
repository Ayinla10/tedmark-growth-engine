"use client";

import { LogOut } from "lucide-react";
import { useTransition } from "react";
import { logoutAction } from "@/lib/auth-actions";
import type { SessionUser } from "@/lib/auth";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function UserMenu({ user, dark = false }: { user: SessionUser; dark?: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className={`flex items-center gap-3 pl-4 border-l ${dark ? "border-slate-700/50" : "border-border-c"}`}>
      <div className="text-right hidden xl:block">
        <p className={`text-sm font-semibold ${dark ? "text-slate-200" : "text-ink"}`}>{user.name || user.email}</p>
        <p className={`text-[11px] capitalize ${dark ? "text-slate-500" : "text-ink-muted"}`}>{user.role}</p>
      </div>
      <div
        className={`w-8 h-8 rounded-full border flex items-center justify-center text-xs font-bold ${
          dark ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" : "bg-brand/20 border-border-c text-brand"
        }`}
      >
        {initials(user.name || user.email)}
      </div>
      <button
        type="button"
        aria-label="Log out"
        disabled={pending}
        onClick={() => startTransition(() => logoutAction())}
        className={`transition-colors disabled:opacity-50 ${dark ? "text-slate-500 hover:text-red-400" : "text-ink-muted hover:text-red-500"}`}
      >
        <LogOut size={16} />
      </button>
    </div>
  );
}
