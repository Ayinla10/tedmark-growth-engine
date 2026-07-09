import { normalizeGhanaPhone } from './contactFinder.js';

// Email wins when present (best for proposals/attachments); otherwise fall
// back to WhatsApp only if the phone number is a genuine Ghanaian mobile
// number. Anything else (landline, unparseable, no contact info) has no
// viable outreach channel.
export function resolveChannel(lead) {
  if (lead.email) return 'email';
  const normalized = normalizeGhanaPhone(lead.phone);
  if (normalized?.isMobile) return 'whatsapp';
  return null;
}
