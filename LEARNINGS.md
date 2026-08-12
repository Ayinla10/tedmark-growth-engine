# Tedmark Engineering — Learnings

Real lessons from real bugs, found while building the Tedmark AI Growth
Engine. Every entry here actually happened and was verified fixed — this
is not a list of generic best practices. Check this file before starting
similar work on another Tedmark project (EduVault, HOXA, etc.), and add to
it whenever a real bug teaches something worth remembering.

Only promote an entry to a cross-project rule once it's shown up in more
than one project — one occurrence is a project-specific lesson, not
necessarily a universal one yet.

---

## AI / LLM

### DeepSeek's reasoning models can silently return empty output if max_tokens is too small

**Problem:** Several AI agents (qualifier, outreach, DM enrichment, ICP
scoring, follow-up sequencer) were calling DeepSeek with a small
`max_tokens` budget (150–500) modeled on what a short JSON answer needs.
Some calls intermittently failed with `Unexpected end of JSON input`,
which looked like random flakiness.

**Cause:** `deepseek-v4-flash` is a reasoning model — it spends part of
its `max_tokens` budget on hidden chain-of-thought (`reasoning_content`)
before writing the actual answer. If the budget runs out mid-thought, the
API returns `finish_reason: "length"` with an **empty** `content` field.
This is deterministic given the input, not flaky — a given prompt either
reliably has enough room to finish reasoning or it doesn't.

**Solution:** Raised every agent's `max_tokens` to 2000, giving real
headroom for both reasoning and the answer. Added an opt-in debug flag
(`LLM_DEBUG=1`) to `tools/llm.js` that logs `finish_reason`, reasoning
length, and content length — makes this failure mode visible immediately
instead of surfacing as a generic parse error.

**Classification:** AI / reliability.
**Potentially reusable:** Yes — any project calling a reasoning model
(DeepSeek reasoner variants, o1/o3-style OpenAI models, etc.) with a tight
token budget can hit this. Rule of thumb: budget for reasoning + answer,
not just the answer, and verify with a debug log before assuming a small
budget is safe.

---

## Multi-tenancy

### A per-request fact must never be cached at module scope in a shared server process

**Problem:** Early draft of `getCurrentAgencyId()` (used by nearly every
dashboard query) cached the resolved agency ID at module scope after the
first lookup.

**Cause:** A Next.js server process is shared across requests from
different logged-in users. Caching a "which agency is this for" answer at
module scope means the first user's agency leaks into every other user's
request for the lifetime of that server process — a real cross-tenant
data leak, not a cosmetic bug.

**Solution:** Split the function into a session-derived path (never
cached — read fresh from the request's session every time) and a
separately-cached fallback-only path (safe to cache, since it only
applies when there's no logged-in session to derive an agency from, e.g.
CLI scripts running against a single-agency database).

**Classification:** Architecture / multi-tenancy.
**Potentially reusable:** Yes — this is a general rule, not
Tedmark-specific: **never cache a per-user or per-request fact at module
scope in a process that serves multiple users.** Only cache facts that
are true for the whole process's lifetime regardless of who's asking.

---

## Phone number / internationalization

### Not every country's phone numbers strip a leading "0" the same way

**Problem:** Generalizing Ghana-only phone normalization to also support
Nigeria, Kenya, Côte d'Ivoire, and Senegal — the first version applied
the same "strip country code, then strip a leading 0" rule to every
country and got Côte d'Ivoire wrong.

**Cause:** Côte d'Ivoire's 2021 phone renumbering removed the separate
trunk "0" that Ghana/Nigeria/Kenya/Senegal all still use — the leading
digit in a CI number is part of the actual 10-digit subscriber number,
not a prefix to strip. Applying the generic rule silently produced a
wrong `+225` number that would never actually reach the business.

**Solution:** Added an explicit `hasTrunkZero` flag per country in a
central registry (`tools/countries.js`) instead of assuming one global
rule. Verified with a real number and a live test before trusting it.

**Classification:** Internationalization / data correctness.
**Potentially reusable:** Yes — general rule for any project expanding to
multiple countries: **never assume one country's formatting rule applies
to another, even ones that look similar.** Check each country's actual
numbering plan, and write a test for each one specifically, not just the
first.

---

## Process notes

- All of the above were caught by **testing with a real, live call** (a
  real lead in the database, a real API response), not just by reading
  code or passing a type-checker. Type checks and unit tests catch a
  different class of bug than "this actually works against reality" —
  keep doing both.
- Each fix above was small (one file, a few lines) once the real cause
  was found. The expensive part was noticing the bug existed at all,
  which only happened because of live verification, not because of a
  process step that would have caught it in advance.
