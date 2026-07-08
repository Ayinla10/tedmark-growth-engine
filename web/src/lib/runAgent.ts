"use server";

import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const BACKEND_ROOT = process.env.BACKEND_ROOT || "D:\\tedmark-growth-engine";

export type AgentRunResult = {
  ok: boolean;
  output: string;
};

function cleanOutput(raw: string): string {
  return raw
    .split("\n")
    .filter((line) => !/DeprecationWarning|trace-deprecation|trace-warnings/i.test(line))
    .join("\n")
    .trim();
}

/**
 * Runs a backend CLI command (node index.js <command> ...args) as a child
 * process and returns its combined stdout/stderr output. Used for anything
 * that touches Playwright, the AI model, or Resend — logic that's already
 * implemented and tested in the CLI, so the dashboard reuses it rather than
 * duplicating it in the web app.
 */
export async function runAgentCommand(command: string, args: string[]): Promise<AgentRunResult> {
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
