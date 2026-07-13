import { execFile } from "child_process";
import { promisify } from "util";
import { readFile, unlink } from "fs/promises";
import path from "path";
import os from "os";
import { NextResponse } from "next/server";

const execFileAsync = promisify(execFile);
const BACKEND_ROOT = process.env.BACKEND_ROOT || "D:\\tedmark-growth-engine";

export const dynamic = "force-dynamic";

// Shells out to the backend CLI (same pattern as every other agent action —
// PDF rendering needs Playwright, which is already a backend dependency)
// to generate the PDF into a temp file, then streams that file back and
// deletes it. Kept as a real file round-trip rather than piping raw bytes
// through stdout, which execFile doesn't handle cleanly for binary data.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tmpPath = path.join(os.tmpdir(), `proposal-${id}-${Date.now()}.pdf`);

  try {
    await execFileAsync(
      "node",
      ["index.js", "export-proposal", "--proposal-id", id, "--out", tmpPath],
      { cwd: BACKEND_ROOT, timeout: 60 * 1000 }
    );

    const pdfBuffer = await readFile(tmpPath);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="proposal-${id}.pdf"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Failed to generate PDF: ${message}` }, { status: 500 });
  } finally {
    await unlink(tmpPath).catch(() => {});
  }
}
