"use client";

import {
  BarChart3,
  Bot,
  Compass,
  FileText,
  HelpCircle,
  History,
  LayoutDashboard,
  LogOut,
  Mail,
  Settings,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/agents", label: "AI Agents", icon: Bot },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/lead-discovery", label: "Lead Discovery", icon: Compass },
  { href: "/qualified-leads", label: "Qualified Leads", icon: ShieldCheck },
  { href: "/outreach", label: "Outreach Drafts", icon: Mail },
  { href: "/follow-ups", label: "Follow-ups", icon: History },
  { href: "/proposals", label: "Proposals", icon: FileText },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="h-screen w-64 fixed left-0 top-0 bg-surface border-r border-border-c shadow-sm flex flex-col py-6 z-50">
      <div className="px-6 mb-8">
        <h1 className="text-2xl font-semibold text-brand leading-tight">Tedmark AI</h1>
        <p className="text-xs text-ink-muted uppercase tracking-widest mt-1">
          Sales Intelligence Hub
        </p>
      </div>
      <nav className="flex-1 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={
                active
                  ? "flex items-center gap-3 px-4 py-3 text-brand font-semibold border-r-4 border-brand hover:bg-surface-2 transition-colors active:scale-95"
                  : "flex items-center gap-3 px-4 py-3 text-ink-secondary hover:bg-surface-2 transition-colors active:scale-95"
              }
            >
              <Icon size={20} aria-hidden="true" />
              <span className="text-sm">{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="px-4 mt-auto pt-6 border-t border-border-c space-y-1">
        <button className="w-full bg-brand text-white font-medium text-sm py-3 rounded-xl mb-4 hover:opacity-90 transition-opacity active:scale-95">
          Deploy new agent
        </button>
        <Link
          href="/help"
          className="flex items-center gap-3 px-4 py-2 text-ink-secondary hover:text-brand transition-all text-sm"
        >
          <HelpCircle size={18} aria-hidden="true" />
          Help center
        </Link>
        <Link
          href="#"
          className="flex items-center gap-3 px-4 py-2 text-ink-secondary hover:text-red-500 transition-all text-sm"
        >
          <LogOut size={18} className="text-red-500" aria-hidden="true" />
          Log out
        </Link>
      </div>
    </aside>
  );
}
