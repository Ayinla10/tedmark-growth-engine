import { chromium } from 'playwright';
import { promises as dns } from 'dns';
import { extractEmails as extractEmailsShared } from './emailUtils.js';

// Ghana mobile prefixes (after +233): MTN, Vodafone/Telecel, AirtelTigo ranges.
const GH_MOBILE_PREFIXES = ['20', '23', '24', '25', '26', '27', '28', '50', '53', '54', '55', '56', '57', '59'];

export function normalizeGhanaPhone(raw) {
  if (!raw) return null;

  let digits = String(raw).replace(/\D/g, '');

  if (digits.startsWith('233')) {
    digits = digits.slice(3);
  }
  if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  if (digits.length !== 9) {
    return null;
  }

  const e164 = `+233${digits}`;
  const isMobile = GH_MOBILE_PREFIXES.includes(digits.slice(0, 2));

  return {
    e164,
    isMobile,
    waLink: `https://wa.me/233${digits}`,
  };
}

export async function verifyEmailDomain(email) {
  const domain = email.split('@')[1];
  if (!domain) return false;

  try {
    const records = await dns.resolveMx(domain);
    return records.length > 0;
  } catch {
    return false;
  }
}

function extractEmails(text) {
  return extractEmailsShared(text);
}

async function collectFromPage(page) {
  const emails = new Set();
  const phones = new Set();

  const mailtos = await page
    .locator('a[href^="mailto:"]')
    .evaluateAll((links) => links.map((l) => l.getAttribute('href')))
    .catch(() => []);
  for (const href of mailtos) {
    const email = href?.replace(/^mailto:/i, '').split('?')[0].trim().toLowerCase();
    if (email) emails.add(email);
  }

  const tels = await page
    .locator('a[href^="tel:"]')
    .evaluateAll((links) => links.map((l) => l.getAttribute('href')))
    .catch(() => []);
  for (const href of tels) {
    const phone = href?.replace(/^tel:/i, '').trim();
    if (phone) phones.add(phone);
  }

  const bodyText = await page.locator('body').innerText().catch(() => '');
  for (const email of extractEmails(bodyText)) {
    emails.add(email);
  }

  return { emails: [...emails], phones: [...phones] };
}

export async function findContactsOnWebsite(url) {
  let browser;

  try {
    browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

    const home = await collectFromPage(page);
    const emails = new Set(home.emails);
    const phones = new Set(home.phones);

    const contactHref = await page
      .locator('a[href*="contact" i]')
      .first()
      .getAttribute('href')
      .catch(() => null);

    if (contactHref) {
      const contactUrl = new URL(contactHref, url).toString();
      try {
        await page.goto(contactUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        const contact = await collectFromPage(page);
        contact.emails.forEach((e) => emails.add(e));
        contact.phones.forEach((p) => phones.add(p));
      } catch (err) {
        console.warn(`[contactFinder] Could not load contact page ${contactUrl}: ${err.message}`);
      }
    }

    return { emails: [...emails], phones: [...phones] };
  } catch (err) {
    console.warn(`[contactFinder] Failed to scan ${url}: ${err.message}`);
    return { emails: [], phones: [] };
  } finally {
    if (browser) await browser.close();
  }
}
