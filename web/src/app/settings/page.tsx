import { readFileSync } from "fs";
import path from "path";
import { AppShell } from "@/components/app-shell";
import { SettingsForm } from "@/components/settings-form";
import { Card, PageHeader } from "@/components/ui";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

const KEYS: { name: string; env: string; purpose: string }[] = [
  { name: "DeepSeek", env: "DEEPSEEK_API_KEY", purpose: "Qualifier, outreach, sequencer, and proposal agents" },
  { name: "Geoapify Places", env: "GEOAPIFY_API_KEY", purpose: "Scout agent business discovery" },
  { name: "Resend", env: "RESEND_API_KEY", purpose: "Sending approved outreach emails" },
  { name: "PostgreSQL", env: "DATABASE_URL", purpose: "Lead and pipeline storage" },
];

function readBackendEnv(): Record<string, boolean> {
  const configured: Record<string, boolean> = {};
  try {
    const envPath = path.resolve(process.cwd(), "..", ".env");
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const match = line.match(/^([A-Z_]+)=(.*)$/);
      if (match) configured[match[1]] = match[2].trim().length > 0;
    }
  } catch {
    // Backend .env not found — fall back to this process's env below.
  }
  return configured;
}

export default async function SettingsPage() {
  const backendEnv = readBackendEnv();
  const settings = await getSettings();

  return (
    <AppShell>
      <section className="p-6 max-w-4xl">
        <PageHeader
          title="Settings"
          subtitle="Everything the agents use to decide what to do and when."
        />

        <Card className="p-5 mb-6">
          <SettingsForm initial={settings} />
        </Card>

        <Card className="p-5 mb-6 bg-amber-500/5 border-amber-500/20">
          <p className="text-sm font-semibold text-ink mb-1">When it runs automatically</p>
          <p className="text-sm text-ink-secondary">
            The daily pipeline runs at <span className="font-mono">07:00 Accra time</span> via a
            scheduled GitHub Actions workflow. That schedule is defined in{" "}
            <span className="font-mono">.github/workflows/daily-pipeline.yml</span>, not in this
            database — GitHub doesn&apos;t support reading a schedule from an app, so changing the
            time means editing that file directly. Ask and it&apos;s a one-line change.
          </p>
        </Card>

        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b border-border-c">
            <p className="text-sm font-semibold text-ink">API keys</p>
            <p className="text-xs text-ink-muted">Managed in the backend .env file — never stored in the browser.</p>
          </div>
          <div className="divide-y divide-border-c">
            {KEYS.map((key) => {
              const configured = backendEnv[key.env] ?? Boolean(process.env[key.env]);
              return (
                <div key={key.env} className="flex items-center justify-between px-5 py-4">
                  <div>
                    <p className="text-sm font-medium text-ink">{key.name}</p>
                    <p className="text-xs text-ink-muted">{key.purpose}</p>
                    <p className="text-xs text-ink-muted font-mono mt-0.5">{key.env}</p>
                  </div>
                  <span
                    className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                      configured
                        ? "bg-green-500/15 text-green-700 dark:text-green-400"
                        : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                    }`}
                  >
                    {configured ? "Configured" : "Not set"}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        <p className="text-xs text-ink-muted mt-4">
          To update keys, edit the backend <span className="font-mono">.env</span> file and{" "}
          <span className="font-mono">web\.env.local</span> (dashboard database access), then restart
          the affected process.
        </p>
      </section>
    </AppShell>
  );
}
