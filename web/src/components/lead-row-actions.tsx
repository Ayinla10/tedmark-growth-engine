"use client";

import { Archive, Mail, ShieldCheck, Target, User, Wrench } from "lucide-react";
import { useTransition, useState } from "react";
import {
  runQualifierAction,
  runEnricherAction,
  runDmEnrichAction,
  runIcpScoreAction,
  runOutreachAction,
  archiveLeadAction,
} from "@/lib/actions";
import { useToast, summariseOutput } from "./toast";
import { EnrichLiveFeed } from "./enrich-live-feed";

type Btn = {
  label: string;
  icon: React.ElementType;
  bg: string;
  color: string;
  hoverBg: string;
  onClick: () => void;
};

export function LeadRowActions({
  leadId,
  showQualify = false,
  showEnrich = false,
  showDmEnrich = false,
  showIcpScore = false,
  showGenerateOutreach = false,
  showArchive = true,
}: {
  leadId: string;
  showQualify?: boolean;
  showEnrich?: boolean;
  showDmEnrich?: boolean;
  showIcpScore?: boolean;
  showGenerateOutreach?: boolean;
  showArchive?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const [enrichStreaming, setEnrichStreaming] = useState(false);
  const toast = useToast();

  function run(label: string, fn: () => Promise<{ ok: boolean; output?: string }>) {
    setActiveLabel(label);
    startTransition(async () => {
      const r = await fn();
      setActiveLabel(null);
      const { title, body } = r.ok
        ? summariseOutput(r.output ?? "", label)
        : { title: `${label} failed`, body: r.output?.split("\n").filter(Boolean).pop() };
      toast.show(r.ok, title, body);
    });
  }

  function runEnrichWithFeedback() {
    setActiveLabel("Enrich");
    startTransition(async () => {
      const r = await runEnricherAction(1, leadId);
      setActiveLabel(null);
      setEnrichStreaming(false); // hide feed only after process fully completes
      const { title, body } = r.ok
        ? summariseOutput(r.output ?? "", "Enrich")
        : { title: "Enrich failed", body: r.output?.split("\n").filter(Boolean).pop() };
      toast.show(r.ok, title, body);
    });
  }

  const buttons: Btn[] = [];

  if (showQualify) buttons.push({
    label: "Qualify",
    icon: ShieldCheck,
    bg: "rgba(34,197,94,0.12)",      color: "#16a34a",
    hoverBg: "rgba(34,197,94,0.22)",
    onClick: () => run("Qualify", () => runQualifierAction(1, leadId)),
  });
  if (showEnrich) buttons.push({
    label: "Enrich",
    icon: Wrench,
    bg: "rgba(168,85,247,0.12)",     color: "#9333ea",
    hoverBg: "rgba(168,85,247,0.22)",
    onClick: () => {
      setEnrichStreaming(true);
      // run() uses startTransition internally; we handle hiding the feed via onDone
      // but keep it visible until the full process finishes (toast fires after)
      runEnrichWithFeedback();
    },
  });
  if (showDmEnrich) buttons.push({
    label: "Find DM",
    icon: User,
    bg: "rgba(245,158,11,0.12)",     color: "#d97706",
    hoverBg: "rgba(245,158,11,0.22)",
    onClick: () => run("Find DM", () => runDmEnrichAction(1, leadId)),
  });
  if (showIcpScore) buttons.push({
    label: "ICP Score",
    icon: Target,
    bg: "rgba(14,165,233,0.12)",     color: "#0284c7",
    hoverBg: "rgba(14,165,233,0.22)",
    onClick: () => run("ICP Score", () => runIcpScoreAction(1, leadId)),
  });
  if (showGenerateOutreach) buttons.push({
    label: "Outreach",
    icon: Mail,
    bg: "rgba(45,106,247,0.12)",     color: "#2D6AF7",
    hoverBg: "rgba(45,106,247,0.22)",
    onClick: () => run("Outreach", () => runOutreachAction(1, leadId)),
  });
  if (showArchive) buttons.push({
    label: "Archive",
    icon: Archive,
    bg: "rgba(239,68,68,0.10)",      color: "#dc2626",
    hoverBg: "rgba(239,68,68,0.20)",
    onClick: () => {
      if (confirm("Archive this lead?")) run("Archive", () => archiveLeadAction(leadId));
    },
  });

  return (
    <>
      <style>{`
        @keyframes spin-btn { to { transform: rotate(360deg); } }
        .btn-spinner { animation: spin-btn 0.7s linear infinite; display: inline-block; }
      `}</style>
      {enrichStreaming && showEnrich && (
        <div className="mt-2 mb-1">
          <EnrichLiveFeed leadId={Number(leadId)} />
        </div>
      )}
      <div className="inline-flex items-center gap-1.5 flex-wrap">
        {buttons.map(({ label, icon: Icon, bg, color, hoverBg, onClick }) => {
          const isActive = pending && activeLabel === label;
          return (
            <button
              key={label}
              type="button"
              disabled={pending}
              onClick={onClick}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg transition-all disabled:opacity-40 whitespace-nowrap cursor-pointer"
              style={{ background: bg, color }}
              onMouseEnter={(e) => { if (!pending) (e.currentTarget as HTMLElement).style.background = hoverBg; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = bg; }}
            >
              {isActive ? (
                <span className="btn-spinner" style={{ width: 12, height: 12 }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="2" strokeOpacity="0.25"/>
                    <path d="M11 6a5 5 0 0 0-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </span>
              ) : (
                <Icon size={12} />
              )}
              {isActive ? (label.endsWith("e") ? label + "ing…" : label + "ing…") : label}
            </button>
          );
        })}
      </div>
    </>
  );
}
