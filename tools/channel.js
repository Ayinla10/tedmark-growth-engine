import { normalizePhone } from './contactFinder.js';

// Email wins when present (best for proposals/attachments); otherwise fall
// back to WhatsApp only if the phone number is a genuine mobile number for
// the lead's country. Anything else (landline, unparseable, no contact
// info) has no viable outreach channel.
export function resolveChannel(lead) {
  if (lead.email) return 'email';
  const normalized = normalizePhone(lead.phone, lead.country);
  if (normalized?.isMobile) return 'whatsapp';
  return null;
}
