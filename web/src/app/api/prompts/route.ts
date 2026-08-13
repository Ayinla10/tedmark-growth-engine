import { NextResponse } from "next/server";
import { readFile, writeFile } from "fs/promises";
import path from "path";

const PROMPTS_DIR = path.resolve(process.env.BACKEND_ROOT ?? "D:\\tedmark-growth-engine", "prompts");

const ALLOWED = new Set([
  "qualify.md",
  "outreach.md",
  "outreach-whatsapp.md",
  "icpScore.md",
  "dmEnrich.md",
  "proposal.md",
  "classify-reply.md",
  "followup-whatsapp.md",
]);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const file = searchParams.get("file");
  if (!file || !ALLOWED.has(file)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const content = await readFile(path.join(PROMPTS_DIR, file), "utf-8");
  return NextResponse.json({ content });
}

export async function POST(req: Request) {
  const { file, content } = await req.json();
  if (!file || !ALLOWED.has(file)) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  if (typeof content !== "string") return NextResponse.json({ error: "Invalid content" }, { status: 400 });
  await writeFile(path.join(PROMPTS_DIR, file), content, "utf-8");
  return NextResponse.json({ ok: true });
}
