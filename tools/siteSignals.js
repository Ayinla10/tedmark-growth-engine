// Pure signal-detection logic, kept free of Playwright/DOM calls so it's
// testable with plain fixture strings. tools/scraper.js gathers the raw
// ingredients (HTML, visible text, viewport/H1 presence) during the same
// page visit it already does for the qualifier, and hands them here.

const TRACKING_PATTERNS = [
  /gtag\(/i,
  /google-analytics\.com/i,
  /googletagmanager\.com/i,
  /connect\.facebook\.net/i,
  /fbq\(/i,
];

const BOOKING_PATTERNS = [
  /calendly\.com/i,
  /simplybook\.me/i,
  /fresha\.com/i,
  /opentable\.com/i,
  /setmore\.com/i,
  /book\.appointy/i,
  /square\.site\/book/i,
];

const CTA_KEYWORDS = [
  'book now',
  'book a',
  'contact us',
  'get a quote',
  'get quote',
  'order now',
  'call us',
  'whatsapp us',
  'schedule',
  'get started',
  'request a quote',
  'buy now',
];

export function detectSiteSignals({ html = '', bodyText = '', hasViewportMeta = false, hasH1 = false, hasMetaDescription = false }) {
  const lowerHtml = html.toLowerCase();
  const lowerText = bodyText.toLowerCase();

  const hasTrackingPixel = TRACKING_PATTERNS.some((p) => p.test(lowerHtml));
  const hasBookingSystem = BOOKING_PATTERNS.some((p) => p.test(lowerHtml));
  const hasClearCta = CTA_KEYWORDS.some((kw) => lowerText.includes(kw));

  const copyrightMatch = bodyText.match(/(?:©|copyright)\s*(\d{4})/i);
  const copyrightYear = copyrightMatch ? parseInt(copyrightMatch[1], 10) : null;
  const currentYear = new Date().getFullYear();
  const hasOldCopyright = copyrightYear !== null && currentYear - copyrightYear >= 2;

  // A rough "looks outdated" heuristic: not mobile-optimized, no tracking
  // set up (nobody's measuring it), and either a stale copyright notice or
  // no heading structure at all.
  const looksOutdated = !hasViewportMeta && !hasTrackingPixel && (hasOldCopyright || !hasH1);

  return {
    mobileFriendly: hasViewportMeta,
    hasTrackingPixel,
    hasClearCta,
    hasBookingSystem,
    hasH1,
    hasMetaDescription,
    copyrightYear,
    looksOutdated,
  };
}
