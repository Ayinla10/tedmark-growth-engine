// Pure helpers for turning a raw parsed email into something the reply
// watcher can act on — no IMAP/network calls in this file, so it's testable
// without a live mailbox.

const JUNK_SENDER_PATTERNS = [/^mailer-daemon@/i, /^postmaster@/i, /^noreply@/i, /^no-reply@/i];

// Addresses like "Acme Clinic <owner@acmeclinic.com>" — pull the bare email.
export function extractSenderEmail(fromField) {
  if (!fromField) return null;
  const match = fromField.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return match ? match[0].toLowerCase() : null;
}

export function isAutomatedSender(email) {
  if (!email) return true;
  return JUNK_SENDER_PATTERNS.some((p) => p.test(email));
}

// Strips common quoted-reply chains ("On Mon, ... wrote:" and everything
// after) so the classifier sees only what the lead actually typed, not the
// full quoted history of the thread.
export function stripQuotedReply(text) {
  if (!text) return '';
  const markers = [
    /\r?\nOn [\s\S]{0,150}?\s+wrote:\r?\n/i,
    /\r?\n-{2,}\s*Original Message\s*-{2,}/i,
    /\r?\nFrom: .+\r?\nSent: /i,
  ];

  let cleaned = text;
  for (const marker of markers) {
    const match = cleaned.match(marker);
    if (match) {
      cleaned = cleaned.slice(0, match.index);
    }
  }

  return cleaned.trim();
}
