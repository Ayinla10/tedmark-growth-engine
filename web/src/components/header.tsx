import { MessageCircle, Search } from "lucide-react";
import { NotificationsDropdown } from "./notifications-dropdown";
import { ThemeToggle } from "./theme-toggle";

export function Header() {
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
        <div className="flex items-center gap-2 px-3 py-1 bg-ai/15 rounded-full border border-ai/30">
          <span className="w-2 h-2 rounded-full bg-ai animate-pulse" />
          <span className="text-xs font-semibold text-ai">AI processing</span>
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
          <div className="flex items-center gap-3 pl-4 border-l border-border-c">
            <div className="text-right hidden xl:block">
              <p className="text-sm font-semibold text-ink">Alex Rivera</p>
              <p className="text-xs text-ink-muted">Agency lead</p>
            </div>
            <div className="w-8 h-8 rounded-full border border-border-c bg-brand/20 flex items-center justify-center text-xs font-semibold text-brand">
              AR
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
