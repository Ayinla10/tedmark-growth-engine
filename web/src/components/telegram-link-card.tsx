"use client";

import { useState, useTransition } from "react";
import {
  generateTelegramLinkCodeAction,
  updateTelegramNotificationLevelAction,
  unlinkTelegramAction,
} from "@/lib/actions";
import type { TelegramLink } from "@/lib/queries";
import { Card } from "./ui";

const LEVELS = ["LOW", "INFO", "IMPORTANT", "ACTION_REQUIRED", "CRITICAL"];

export function TelegramLinkCard({ link, botUsername }: { link: TelegramLink | null; botUsername: string | null }) {
  const [pending, startTransition] = useTransition();
  const [code, setCode] = useState<string | null>(null);
  const [level, setLevel] = useState(link?.min_notification_level ?? "INFO");

  function generateCode() {
    startTransition(async () => {
      const r = await generateTelegramLinkCodeAction();
      if (r.ok && r.code) setCode(r.code);
    });
  }

  function changeLevel(newLevel: string) {
    setLevel(newLevel);
    startTransition(() => {
      updateTelegramNotificationLevelAction(newLevel);
    });
  }

  function unlink() {
    if (!confirm("Disconnect Telegram? You'll stop receiving notifications and approval requests there.")) return;
    startTransition(async () => {
      await unlinkTelegramAction();
      setCode(null);
    });
  }

  if (link) {
    return (
      <Card className="p-5">
        <p className="text-sm font-semibold text-ink mb-1">Telegram</p>
        <p className="text-xs text-ink-muted mb-4">
          Connected as {link.telegram_username ? `@${link.telegram_username}` : "an unnamed account"} since{" "}
          {new Date(link.linked_at).toLocaleDateString()}.
        </p>
        <div className="flex items-center gap-3 mb-4">
          <label className="text-xs text-ink-secondary">Minimum notification level</label>
          <select value={level} onChange={(e) => changeLevel(e.target.value)} disabled={pending} className="text-sm">
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <p className="text-xs text-ink-muted mb-4">
          Approval requests always come through regardless of this setting.
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={unlink}
          className="text-xs text-red-500 hover:underline disabled:opacity-50"
        >
          Disconnect Telegram
        </button>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <p className="text-sm font-semibold text-ink mb-1">Telegram</p>
      <p className="text-xs text-ink-muted mb-4">
        Not connected. Link your account to get notifications, approve outreach drafts, and check status — all
        from Telegram.
      </p>
      {code ? (
        <div className="bg-surface-2 rounded-lg p-3 text-sm">
          <p className="text-ink-secondary mb-1">
            Message {botUsername ? `@${botUsername}` : "the bot"} on Telegram with:
          </p>
          <p className="font-mono text-ink">/link {code}</p>
          <p className="text-xs text-ink-muted mt-1">Expires in 10 minutes.</p>
        </div>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={generateCode}
          className="bg-brand text-white px-4 py-2 rounded-lg text-sm disabled:opacity-60"
        >
          {pending ? "Generating…" : "Connect Telegram"}
        </button>
      )}
    </Card>
  );
}
