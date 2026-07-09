import {
  BarChart3,
  BookOpen,
  Bot,
  Compass,
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
  { href: "/help", label: "Knowledge Base", icon: BookOpen },
  { href: "/settings", label: "Settings", icon: Settings },
];

// Immersive dark shell for the AI command center. Deliberately independent
// of the app theme — the command center is always dark, like the rest of
// the JARVIS aesthetic on this page.
export async function CommandShell({ children }: { children: ReactNode }) {
  const user = await getSession();

  return (
    <div className="min-h-screen bg-[#04060d] text-slate-200 flex">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 border-r border-emerald-500/10 bg-[#060a14] flex flex-col fixed inset-y-0 left-0 z-50">
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-center gap-2">
            <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
              <path d="M4 6l9-4 9 4-9 4-9-4z" fill="#22c55e" />
              <path d="M4 6v8l9 4v-8L4 6z" fill="#16a34a" />
              <path d="M22 6v8l-9 4v-8l9-4z" fill="#4ade80" />
            </svg>
            <h1 className="text-lg font-bold text-emerald-400">Tedmark AI</h1>
          </div>
          <p className="text-[10px] tracking-[0.25em] text-slate-500 mt-1">SALES INTELLIGENCE HUB</p>
        </div>

        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors ${
                item.active
                  ? "bg-emerald-500/10 text-emerald-400 border-l-2 border-emerald-400"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
              }`}
            >
              <item.icon size={17} />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="px-4 py-3">
          <button
            type="button"
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-emerald-500/40 text-emerald-400 text-sm font-semibold hover:bg-emerald-500/10 transition-colors"
          >
            <Plus size={16} />
            Deploy New Agent
          </button>
        </div>

        <div className="px-4 pb-2 space-y-1">
          <Link href="/help" className="flex items-center gap-3 px-3 py-1.5 rounded-xl text-sm text-slate-400 hover:text-slate-200">
            <HelpCircle size={16} />
            Help Center
          </Link>
        </div>

        <div className="mx-4 mb-4 rounded-2xl border border-emerald-500/15 bg-[#070d18] p-3">
          <p className="text-[10px] tracking-[0.2em] text-slate-500 uppercase mb-1.5">System status</p>
          <p className="text-xs text-emerald-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            All Systems Operational
          </p>
          <p className="text-[10px] text-slate-500 mt-1 pl-3">99.98% Uptime</p>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 ml-60 flex flex-col min-w-0">
        <header className="h-16 shrink-0 border-b border-emerald-500/10 bg-[#060a14]/90 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-40">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <input
              type="text"
              placeholder="Search agents, leads, tasks..."
              className="bg-[#0b1120] border border-slate-700/40 rounded-lg pl-9 pr-4 py-1.5 text-sm w-72 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
            />
          </div>
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-2 px-3 py-1 bg-indigo-500/15 rounded-full border border-indigo-400/30 text-indigo-300">
              <JarvisRing size={15} />
              <span className="text-xs font-semibold">Listening</span>
            </div>
            <div className="text-slate-400">
              <NotificationsDropdown />
            </div>
            {user ? <UserMenu user={user} dark /> : null}
          </div>
        </header>

        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
