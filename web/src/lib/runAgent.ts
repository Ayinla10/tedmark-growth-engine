"use server";

export type AgentRunResult = {
  ok: boolean;
  output: string;
};

const RENDER_API_URL    = process.env.RENDER_API_URL;    // e.g. https://tedmark-agents.onrender.com
const RENDER_API_SECRET = process.env.RENDER_API_SECRET; // shared secret

/**
 * Calls the Render agent server to run a backend command.
 * On Vercel, child_process.execFile cannot run long-lived Node processes —
 * the agent server on Render handles execution and streams the result back.
 *
 * Falls back to child_process (for local dev without Render configured).
 */
export async function runAgentCommand(command: string, args: string[]): Promise<AgentRunResult> {
  // ── Remote path (production on Vercel → Render) ──────────────────────────────
  if (RENDER_API_URL && RENDER_API_SECRET) {
    // Convert flat args array ["--sector", "food", "--limit", "20"] into { sector: "food", limit: "20" }
    const argsObj: Record<string, string> = {};
    for (let i = 0; i < args.length; i += 2) {
      if (args[i]?.startsWith("--")) {
        argsObj[args[i].slice(2)] = args[i + 1] ?? "true";
      }
    }

    try {
      const res = await fetch(`${RENDER_API_URL}/run/${command}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RENDER_API_SECRET}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ args: argsObj }),
        // No timeout here — Next.js server actions time out at their own boundary
      });

      const data = await res.json() as { ok: boolean; output: string };
      return { ok: data.ok, output: data.output ?? "" };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, output: `Agent server error: ${msg}` };
    }
  }

  // ── Local fallback (dev machine with agents co-located) ───────────────────────
  const { execFile } = await import("child_process");
  const { promisify } = await import("util");
  const execFileAsync = promisify(execFile);

  const BACKEND_ROOT = process.env.BACKEND_ROOT ?? "D:\\tedmark-growth-engine";

  function cleanOutput(raw: string) {
    return raw
      .split("\n")
      .filter(l => !/DeprecationWarning|trace-deprecation|trace-warnings/i.test(l))
      .join("\n")
      .trim();
  }

  try {
    const { stdout, stderr } = await execFileAsync(
      "node",
      ["index.js", command, ...args],
      { cwd: BACKEND_ROOT, timeout: 5 * 60 * 1000, maxBuffer: 10 * 1024 * 1024 }
    );
    return { ok: true, output: cleanOutput(stdout + (stderr ? `\n${stderr}` : "")) };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    const combined = `${e.stdout ?? ""}\n${e.stderr ?? ""}`.trim();
    return { ok: false, output: cleanOutput(combined || e.message || "Unknown error") };
  }
}
