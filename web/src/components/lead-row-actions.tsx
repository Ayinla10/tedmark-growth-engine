"use client";

import { Archive, Mail, ShieldCheck, User, Wrench } from "lucide-react";
import { useState, useTransition } from "react";
import {
  runQualifierAction,
  runEnricherAction,
  runDmEnrichAction,
  runOutreachAction,
  archiveLeadAction,
} from "@/lib/actions";
import { ResultBanner } from "./modal";

export function LeadRowActions({
  leadId,
  showQualify = false,
  showEnrich = false,
  showDmEnrich = false,
  showGenerateOutreach = false,
  showArchive = true,
}: {
  leadId: string;
  showQualify?: boolean;
  showEnrich?: boolean;
  showDmEnrich?: boolean;
  showGenerateOutreach?: boolean;
  showArchive?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; output?: string; label: string } | null>(null);

  function run(label: string, fn: () => Promise<{ ok: boolean; output?: string }>) {
    startTransition(async () => {
      setResult(null);
      const r = await fn();
      setResult({ ...r, label });
    });
  }

  return (
    <div className="relative inline-flex items-center gap-1">
      {showQualify && (
        <button
          type="button"
          title="Qualify this lead"
          disabled={pending}
          onClick={() => run("qualify", () => runQualifierAction(1, leadId))}
          className="p-1.5 rounded-md text-ink-muted hover:text-brand hover:bg-surface-2 disabled:opacity-50"
        >
          <ShieldCheck size={15} />
        </button>
      )}
      {showEnrich && (
        <button
          type="button"
          title="Enrich contact info"
          disabled={pending}
          onClick={() => run("enrich", () => runEnricherAction(1, leadId))}
          className="p-1.5 rounded-md text-ink-muted hover:text-brand hover:bg-surface-2 disabled:opacity-50"
        >
          <Wrench size={15} />
        </button>
      )}
      {showDmEnrich && (
        <button
          type="button"
          title="Find decision-maker contact"
          disabled={pending}
          onClick={() => run("enrich-dm", () => runDmEnrichAction(1, leadId))}
          className="p-1.5 rounded-md text-ink-muted hover:text-brand hover:bg-surface-2 disabled:opacity-50"
        >
          <User size={15} />
        </button>
      )}
      {showGenerateOutreach && (
        <button
          type="button"
          title="Generate outreach draft"
          disabled={pending}
          onClick={() => run("outreach", () => runOutreachAction(1, leadId))}
          className="p-1.5 rounded-md text-ink-muted hover:text-brand hover:bg-surface-2 disabled:opacity-50"
        >
          <Mail size={15} />
        </button>
      )}
      {showArchive && (
        <button
          type="button"
          title="Archive lead"
          disabled={pending}
          onClick={() => {
            if (confirm("Archive this lead?")) {
              run("archive", () => archiveLeadAction(leadId));
            }
          }}
          className="p-1.5 rounded-md text-ink-muted hover:text-red-500 hover:bg-surface-2 disabled:opacity-50"
        >
          <Archive size={15} />
        </button>
      )}

      {result ? (
        <div className="absolute top-full right-0 z-10 w-72 mt-1">
          <ResultBanner ok={result.ok} output={result.output ?? (result.ok ? `${result.label} done` : "Failed")} />
        </div>
      ) : null}
    </div>
  );
}
