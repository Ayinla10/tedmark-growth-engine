import { getLeadsNeedingContactInfo, updateLeadContact, getLeadById, markLeadEnriched } from '../tools/db.js';
import {
  findContactsOnWebsite,
  normalizeGhanaPhone,
  verifyEmailDomain,
} from '../tools/contactFinder.js';

export async function runEnricher({ limit, leadId }) {
  let leads;

  if (leadId) {
    console.log(`[enricher] Fetching lead ${leadId}...`);
    const lead = await getLeadById(leadId);
    if (!lead) {
      console.error(`[enricher] No lead found with id ${leadId}.`);
      return;
    }
    leads = [lead];
  } else {
    console.log(`[enricher] Fetching up to ${limit} leads to enrich...`);
    leads = await getLeadsNeedingContactInfo(limit);
  }

  if (leads.length === 0) {
    console.log('[enricher] No leads need enrichment. Nothing to do.');
    return;
  }

  console.log(`[enricher] Enriching ${leads.length} leads...`);

  let emailsFound = 0;
  let phonesNormalized = 0;

  for (const lead of leads) {
    const updates = {};
    const notes = [];

    let foundEmails = [];
    let foundPhones = [];

    if (lead.website_url && !lead.email) {
      console.log(`[enricher] Scanning ${lead.website_url} for contacts...`);
      const contacts = await findContactsOnWebsite(lead.website_url);
      foundEmails = contacts.emails;
      foundPhones = contacts.phones;
    }

    if (!lead.email && foundEmails.length > 0) {
      for (const email of foundEmails) {
        const domainOk = await verifyEmailDomain(email);
        if (domainOk) {
          updates.email = email;
          emailsFound += 1;
          notes.push(`email: ${email} (domain accepts mail)`);
          break;
        }
        console.log(`[enricher]   Rejected ${email} — domain has no mail server.`);
      }
    }

    const phoneCandidates = [lead.phone, ...foundPhones].filter(Boolean);
    let normalized = null;
    for (const candidate of phoneCandidates) {
      normalized = normalizeGhanaPhone(candidate);
      if (normalized) break;
    }

    if (normalized && normalized.e164 !== lead.phone) {
      updates.phone = normalized.e164;
      phonesNormalized += 1;
    }

    if (normalized) {
      notes.push(
        normalized.isMobile
          ? `WhatsApp: ${normalized.waLink}`
          : `phone ${normalized.e164} is a landline — unlikely on WhatsApp`
      );
    }

    if (Object.keys(updates).length > 0) {
      await updateLeadContact(lead.id, updates);
      console.log(`[enricher] Updated "${lead.business_name}" — ${notes.join(' | ')}`);
    } else if (notes.length > 0) {
      console.log(`[enricher] "${lead.business_name}" already clean — ${notes.join(' | ')}`);
    } else {
      console.log(`[enricher] "${lead.business_name}" — no website, no usable phone. Needs manual research.`);
    }

    await markLeadEnriched(lead.id);
  }

  console.log(`[enricher] Done. ${emailsFound} emails found, ${phonesNormalized} phones normalized.`);
}
