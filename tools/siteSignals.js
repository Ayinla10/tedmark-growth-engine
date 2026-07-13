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

// Live-chat / chatbot widgets — if none of these are present, a WhatsApp or
// website chatbot is a real automation opportunity, not just "nice to have".
const CHAT_WIDGET_PATTERNS = [
  /tawk\.to/i,
  /widget\.intercom\.io/i,
  /crisp\.chat/i,
  /tidio(chat)?\.com/i,
  /js\.driftt\.com/i,
  /wa\.me\//i,
  /api\.whatsapp\.com\/send/i,
];

// Email-capture — a newsletter signup or lead-capture form feeding an ESP.
// Absence means no automated nurture is possible at all.
const EMAIL_CAPTURE_PATTERNS = [
  /mailchimp\.com/i,
  /list-manage\.com/i,
  /klaviyo\.com/i,
  /convertkit\.com/i,
  /sendinblue\.com|brevo\.com/i,
  /getresponse\.com/i,
];

const EMAIL_CAPTURE_KEYWORDS = ['subscribe', 'newsletter', 'join our mailing list', 'sign up for updates'];

const SOCIAL_LINK_PATTERNS = [
  /facebook\.com\//i,
  /instagram\.com\//i,
  /linkedin\.com\/(company|in)\//i,
  /(twitter|x)\.com\//i,
  /tiktok\.com\//i,
];

// Online ordering/payment — common Ghanaian/African payment processors plus
// the usual e-commerce platforms.
const ECOMMERCE_PATTERNS = [
  /cdn\.shopify\.com/i,
  /woocommerce/i,
  /paystack\.com/i,
  /flutterwave\.com/i,
  /add[\s-]?to[\s-]?cart/i,
];

export function detectSiteSignals({ html = '', bodyText = '', hasViewportMeta = false, hasH1 = false, hasMetaDescription = false }) {
  const lowerHtml = html.toLowerCase();
  const lowerText = bodyText.toLowerCase();

  const hasTrackingPixel = TRACKING_PATTERNS.some((p) => p.test(lowerHtml));
  const hasBookingSystem = BOOKING_PATTERNS.some((p) => p.test(lowerHtml));
  const hasClearCta = CTA_KEYWORDS.some((kw) => lowerText.includes(kw));
  const hasChatWidget = CHAT_WIDGET_PATTERNS.some((p) => p.test(lowerHtml));
  const hasEmailCapture =
    EMAIL_CAPTURE_PATTERNS.some((p) => p.test(lowerHtml)) || EMAIL_CAPTURE_KEYWORDS.some((kw) => lowerText.includes(kw));
  const hasSocialLinks = SOCIAL_LINK_PATTERNS.some((p) => p.test(lowerHtml));
  const hasEcommerce = ECOMMERCE_PATTERNS.some((p) => p.test(lowerHtml));

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
    hasChatWidget,
    hasEmailCapture,
    hasSocialLinks,
    hasEcommerce,
    hasH1,
    hasMetaDescription,
    copyrightYear,
    looksOutdated,
  };
}
