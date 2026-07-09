import { MessageCircle, Search } from "lucide-react";
import type { SessionUser } from "@/lib/auth";
import { JarvisRing } from "./jarvis-ring";
import { NotificationsDropdown } from "./notifications-dropdown";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

export function Header({ user }: { user: SessionUser | null }) {
  return (
    <header className="fixed top-0 right-0 left-64 h-16 bg-surface/80 backdrop-blur-md flex justify-between items-center px-6 z-40 border-b border-border-c">
      <div className="flex items-center gap-4">
        <div className="relative focus-within:ring-2 focus-within:ring-brand/15 rounded-lg">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
            aria-hidden="true"
          />
          <input
            type="text"
            placeholder="Search agents..."
            className="bg-surface-2 border-none rounded-lg pl-10 pr-4 py-1.5 text-sm w-64 text-ink focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
        </div>
      </div>
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 px-3 py-1 bg-ai/15 rounded-full border border-ai/30 text-ai">
          <JarvisRing size={16} />
          <span className="text-xs font-semibold">Listening</span>
        </div>
        <div className="flex items-center gap-4 text-ink-secondary">
          <ThemeToggle />
          <NotificationsDropdown />
          <button
            type="button"
            aria-label="Messages"
            className="hover:text-brand transition-all active:scale-95"
          >
            <MessageCircle size={20} />
          </button>
          {user ? <UserMenu user={user} /> : null}
        </div>
      </div>
    </header>
  );
}
