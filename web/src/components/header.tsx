import { Bell, Search, Sparkles } from "lucide-react";
import type { SessionUser } from "@/lib/auth";
import { JarvisRing } from "./jarvis-ring";
import { NotificationsDropdown } from "./notifications-dropdown";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

export function Header({ user }: { user: SessionUser | null }) {
  return (
    <header
      className="fixed top-0 left-0 right-0 h-14 z-40 flex items-center justify-between pl-14 pr-5 md:pl-5 md:left-[240px]"
      style={{
        background: "var(--surface)",
        borderBottom: "1px solid var(--border-c)",
      }}
    >
      {/* Left: search */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: "var(--ink-muted)" }}
          />
          <input
            type="text"
            placeholder="Search leads, agents…"
            className="pl-9 pr-4 py-1.5 text-sm rounded-lg w-56"
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border-c)",
              color: "var(--ink)",
            }}
          />
        </div>
      </div>

      {/* Right: status + actions + user */}
      <div className="flex items-center gap-3">
        {/* AI listening pill */}
        <div
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold"
          style={{
            background: "rgba(124,58,237,0.1)",
            border: "1px solid rgba(124,58,237,0.2)",
            color: "#7c3aed",
          }}
        >
          <JarvisRing size={14} />
          <span>AI Active</span>
        </div>

        {/* Daily scout indicator */}
        <div
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
          style={{
            background: "rgba(45,106,247,0.08)",
            border: "1px solid rgba(45,106,247,0.15)",
            color: "var(--brand)",
          }}
        >
          <Sparkles size={12} />
          <span>Scout runs at 7 AM</span>
        </div>

        <div
          className="h-5 w-px mx-1"
          style={{ background: "var(--border-c)" }}
        />

        <ThemeToggle />
        <NotificationsDropdown />
        {user ? <UserMenu user={user} /> : null}
      </div>
    </header>
  );
}
