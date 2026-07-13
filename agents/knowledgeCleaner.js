import { complete } from '../tools/llm.js';

const SYSTEM_PROMPT = `You clean up raw, messy text (pasted from a website, document, or notes) into a
concise, well-structured knowledge entry for a specific category. Keep every real fact —
prices, numbers, names, claims — exactly as given; never invent details that weren't in
the source text. Strip navigation menus, cookie banners, and other non-content noise.
Write plainly, in a form someone could paste directly into a company knowledge base.
Return only the cleaned content, no preamble or explanation.`;

export async function runCleanKnowledge({ category, text }) {
  const cleaned = await complete({
    system: SYSTEM_PROMPT,
    user: `Category: ${category}\n\nRaw text:\n${text}`,
    maxTokens: 800,
  });
  console.log(cleaned.trim());
  return cleaned.trim();
}
