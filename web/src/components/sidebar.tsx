"use client";

import {
  Bot,
  Cpu,
  DollarSign,
  GraduationCap,
  HelpCircle,
  Home,
  Menu,
  MessageSquare,
  Settings,
  Target,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV_ITEMS = [
  { href: "/home",          label: "Home",          icon: Home },
  { href: "/opportunities", label: "Opportunities",  icon: Target },
  { href: "/conversations", label: "Conversations",  icon: MessageSquare },
  { href: "/deals",         label: "Deals",          icon: DollarSign },
  { href: "/growth",        label: "Growth",         icon: TrendingUp },
  { href: "/copilot",       label: "AI Copilot",     icon: Bot },
  { href: "/autopilot",     label: "AI Autopilot",   icon: Cpu },
  { href: "/settings",      label: "Settings",       icon: Settings },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  function isActive(href: string): boolean {
    // Exact match for /home to avoid matching everything
    if (href === "/home") return pathname === "/home";
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <>
      {/* ── Mobile hamburger button ── only visible on < 768px ─────── */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-3.5 left-4 z-50 flex items-center justify-center w-7 h-7 rounded-lg"
        style={{ background: "var(--surface)", border: "1px solid var(--border-c)", color: "var(--ink)" }}
        aria-label="Open navigation"
      >
        <Menu size={16} />
      </button>

      {/* ── Mobile backdrop ───────────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Sidebar panel ────────────────────────────────────────── */}
      {/* Mobile: hidden unless mobileOpen. Desktop (md+): always visible. */}
      <aside
        className={`h-screen fixed left-0 top-0 z-50 flex flex-col transition-transform duration-300 md:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
        style={{
          width: "240px",
          background: "#0f1117",
          borderRight: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {/* Logo + mobile close */}
        <div
          className="flex items-center px-4 py-5 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div
            className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0"
            style={{ background: "var(--brand)" }}
          >
            <Zap size={16} color="#fff" fill="#fff" />
          </div>
          <div className="ml-3 flex-1 overflow-hidden">
            <p className="text-sm font-bold text-white leading-none whitespace-nowrap">Tedmark AI</p>
            <p className="text-[10px] mt-0.5 whitespace-nowrap" style={{ color: "rgba(255,255,255,0.35)" }}>
              Growth Engine
            </p>
          </div>
          {/* Mobile close button */}
          <button
            onClick={() => setMobileOpen(false)}
            className="md:hidden ml-auto flex items-center justify-center w-7 h-7 rounded-lg"
            style={{ color: "rgba(255,255,255,0.4)" }}
            aria-label="Close navigation"
          >
            <X size={16} />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-3" style={{ scrollbarWidth: "none" }}>
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className="relative flex items-center gap-3 mx-2 rounded-lg transition-all duration-150 mb-0.5"
                style={{
                  padding: "9px 12px",
                  background: active ? "rgba(45,106,247,0.18)" : "transparent",
                  color: active ? "#fff" : "rgba(255,255,255,0.5)",
                }}
                onMouseEnter={(e) => {
                  if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
                  (e.currentTarget as HTMLElement).style.color = "#fff";
                }}
                onMouseLeave={(e) => {
                  if (!active) (e.currentTarget as HTMLElement).style.background = "transparent";
                  (e.currentTarget as HTMLElement).style.color = active ? "#fff" : "rgba(255,255,255,0.5)";
                }}
              >
                {active && (
                  <span
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full"
                    style={{ background: "var(--brand)" }}
                  />
                )}
                <Icon size={17} style={{ color: active ? "var(--brand)" : "inherit", flexShrink: 0 }} />
                <span className="text-sm font-medium whitespace-nowrap">{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="flex-shrink-0 p-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <Link
            href="/tutorial"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm mb-1 transition-all"
            style={{ color: "rgba(255,255,255,0.4)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#fff"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.4)"; }}
          >
            <GraduationCap size={15} />
            <span>Tutorial</span>
          </Link>
          <Link
            href="/help"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm"
            style={{ color: "rgba(255,255,255,0.4)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#fff"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.4)"; }}
          >
            <HelpCircle size={15} />
            <span>Help center</span>
          </Link>
        </div>
      </aside>
    </>
  );
}
