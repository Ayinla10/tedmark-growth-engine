import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { BookOpen, FileText, Settings2, Cpu } from "lucide-react";

export const dynamic = "force-dynamic";

const AUTOPILOT_SECTIONS = [
  {
    href: "/knowledge-base",
    icon: BookOpen,
    title: "Knowledge Base",
    description:
      "Manage company information, service descriptions, and case studies that the AI injects into outreach, proposals, and follow-ups.",
    badge: "Active",
  },
  {
    href: "/prompts",
    icon: FileText,
    title: "AI Prompts",
    description:
      "Review and edit the instructions that guide each AI agent — how leads are qualified, how outreach is written, how proposals are structured.",
    badge: "Advanced",
    warning: true,
  },
  {
    href: "/settings",
    icon: Settings2,
    title: "Automation Settings",
    description:
      "Configure scout countries and sectors, outreach limits, follow-up sequences, and daily pipeline schedules.",
    badge: null,
  },
];

export default function AutopilotPage() {
  return (
    <AppShell>
      <section className="p-4 sm:p-6 max-w-3xl">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(45,106,247,0.1)" }}
            >
              <Cpu size={20} style={{ color: "var(--brand)" }} />
            </div>
            <div>
              <h1 className="text-xl font-bold" style={{ color: "var(--ink)" }}>
                AI Autopilot
              </h1>
              <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
                Configure what the AI does automatically, every day.
              </p>
            </div>
          </div>
          <div
            className="p-4 rounded-xl text-sm"
            style={{
              background: "rgba(45,106,247,0.05)",
              border: "1px solid rgba(45,106,247,0.15)",
              color: "var(--ink-secondary)",
            }}
          >
            <strong style={{ color: "var(--ink)" }}>Autopilot</strong> vs{" "}
            <strong style={{ color: "var(--ink)" }}>Copilot:</strong> Copilot is for running
            agents on demand right now. Autopilot is for configuring what the AI should keep doing
            automatically — the knowledge it draws on, the instructions it follows, and the schedule
            it runs on.
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-4">
          {AUTOPILOT_SECTIONS.map(({ href, icon: Icon, title, description, badge, warning }) => (
            <Link
              key={href}
              href={href}
              className="block rounded-2xl p-5 transition-all"
              style={{
                background: "var(--surface)",
                border: `1px solid ${warning ? "rgba(251,191,36,0.25)" : "var(--border-c)"}`,
              }}
            >
              <div className="flex items-start gap-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                  style={{
                    background: warning ? "rgba(251,191,36,0.08)" : "var(--surface-2)",
                  }}
                >
                  <Icon
                    size={18}
                    style={{ color: warning ? "rgb(251,191,36)" : "var(--brand)" }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                      {title}
                    </p>
                    {badge && (
                      <span
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                        style={{
                          background: warning ? "rgba(251,191,36,0.1)" : "rgba(45,106,247,0.1)",
                          color: warning ? "rgb(251,191,36)" : "var(--brand)",
                        }}
                      >
                        {badge}
                      </span>
                    )}
                  </div>
                  <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
                    {description}
                  </p>
                  {warning && (
                    <p className="text-xs mt-2 font-medium" style={{ color: "rgb(251,191,36)" }}>
                      Changes take effect immediately on the next agent run.
                    </p>
                  )}
                </div>
                <span className="text-lg shrink-0" style={{ color: "var(--ink-muted)" }}>
                  →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
