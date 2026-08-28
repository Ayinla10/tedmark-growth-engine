import {
  BarChart3,
  BookOpen,
  Bot,
  Compass,
  DollarSign,
  FileText,
  History,
  HelpCircle,
  LayoutGrid,
  Mail,
  Plus,
  Search,
  Settings,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { getSession } from "@/lib/auth";
import { JarvisRing } from "./jarvis-ring";
import { NotificationsDropdown } from "./notifications-dropdown";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

const NAV = [
  { href: "/agents", label: "AI Orchestrator", icon: Bot, active: true },
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/lead-discovery", label: "Lead Discovery", icon: Compass },
  { href: "/qualified-leads", label: "Qualified Leads", icon: ShieldCheck },
  { href: "/outreach", label: "Outreach Drafts", icon: Mail },
  { href: "/follow-ups", label: "Follow-ups", icon: History },
  { href: "/proposals", label: "Proposals", icon: FileText },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/costs", label: "API Spend", icon: DollarSign },
  { href: "/knowledge-base", label: "Knowledge Base", icon: BookOpen },
  { href: "/settings", label: "Settings", icon: Settings },
];

export async function CommandShell({ children }: { children: ReactNode }) {
  const user = await getSession();

  return (
    <div className="min-h-screen flex" style={{ background: "var(--app-bg)", color: "var(--ink)" }}>
      {/* Sidebar */}
      <aside className="w-60 shrink-0 flex flex-col fixed inset-y-0 left-0 z-50"
        style={{ background: "var(--surface)", borderRight: "1px solid var(--border-c)" }}>
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-center gap-2">
            <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
              <path d="M4 6l9-4 9 4-9 4-9-4z" fill="#2D6AF7" />
              <path d="M4 6v8l9 4v-8L4 6z" fill="#1a4fd6" />
              <path d="M22 6v8l-9 4v-8l9-4z" fill="#6b9fff" />
            </svg>
            <h1 className="text-lg font-bold" style={{ color: "var(--brand)" }}>Tedmark AI</h1>
          </div>
          <p className="text-[10px] tracking-[0.25em] mt-1" style={{ color: "var(--ink-muted)" }}>SALES INTELLIGENCE HUB</p>
        </div>

        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors"
              style={item.active
                ? { background: "rgba(45,106,247,0.12)", color: "var(--brand)", borderLeft: "2px solid var(--brand)" }
                : { color: "var(--ink-muted)" }
              }
            >
              <item.icon size={17} />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="px-4 py-3">
          <button
            type="button"
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors"
            style={{ border: "1px solid rgba(45,106,247,0.4)", color: "var(--brand)" }}
          >
            <Plus size={16} />
            Deploy New Agent
          </button>
        </div>

        <div className="px-4 pb-2 space-y-1">
          <Link href="/help" className="flex items-center gap-3 px-3 py-1.5 rounded-xl text-sm" style={{ color: "var(--ink-muted)" }}>
            <HelpCircle size={16} />
            Help Center
          </Link>
        </div>

        <div className="mx-4 mb-4 rounded-2xl p-3" style={{ border: "1px solid var(--border-c)", background: "var(--surface-2)" }}>
          <p className="text-[10px] tracking-[0.2em] uppercase mb-1.5" style={{ color: "var(--ink-muted)" }}>System status</p>
          <p className="text-xs flex items-center gap-1.5" style={{ color: "var(--brand)" }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--brand)" }} />
            All Systems Operational
          </p>
          <p className="text-[10px] mt-1 pl-3" style={{ color: "var(--ink-muted)" }}>99.98% Uptime</p>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 ml-60 flex flex-col min-w-0">
        <header className="h-16 shrink-0 flex items-center justify-between px-6 sticky top-0 z-40 backdrop-blur-md"
          style={{ background: "color-mix(in srgb, var(--surface) 90%, transparent)", borderBottom: "1px solid var(--border-c)" }}>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--ink-muted)" }} aria-hidden="true" />
            <input
              type="text"
              placeholder="Search agents, leads, tasks..."
              className="rounded-lg pl-9 pr-4 py-1.5 text-sm w-72 focus:outline-none focus:ring-2"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border-c)",
                color: "var(--ink)",
              }}
            />
          </div>
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full border" style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)", color: "#818cf8" }}>
              <JarvisRing size={15} />
              <span className="text-xs font-semibold">Listening</span>
            </div>
            <ThemeToggle />
            <div style={{ color: "var(--ink-muted)" }}>
              <NotificationsDropdown />
            </div>
            {user ? <UserMenu user={user} /> : null}
          </div>
        </header>

        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
