import { chromium } from 'playwright';
import { marked } from 'marked';

// Turns a proposal's markdown content into a styled, letterhead-branded HTML
// page, then prints it to a PDF via headless Chromium — this is the exact
// same content shown in the dashboard's proposal preview modal, just
// rendered to a document instead of a browser DOM.
function buildHtml({ businessName, services, budgetRange, content, createdAt }) {
  const bodyHtml = marked.parse(content ?? '');
  const dateStr = new Date(createdAt ?? Date.now()).toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; margin: 0; padding: 48px 56px; }
  .letterhead { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 3px solid #1d4ed8; padding-bottom: 16px; margin-bottom: 32px; }
  .letterhead h1 { font-size: 20px; margin: 0; color: #1d4ed8; }
  .letterhead .meta { font-size: 12px; color: #666; text-align: right; }
  .cover { margin-bottom: 28px; }
  .cover h2 { font-size: 26px; margin: 0 0 6px; }
  .cover p { font-size: 13px; color: #555; margin: 2px 0; }
  h1, h2, h3 { color: #111; }
  h2 { font-size: 18px; border-bottom: 1px solid #eee; padding-bottom: 6px; margin-top: 28px; }
  h3 { font-size: 15px; margin-top: 20px; }
  p, li { font-size: 13px; line-height: 1.6; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; }
  th, td { border: 1px solid #ddd; padding: 8px 10px; font-size: 12px; text-align: left; }
  th { background: #f5f7fb; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #eee; font-size: 11px; color: #888; }
</style>
</head>
<body>
  <div class="letterhead">
    <h1>Tedmark Digital Agency</h1>
    <div class="meta">Accra, Ghana &bull; tedmarkdigital.com</div>
  </div>
  <div class="cover">
    <h2>Proposal for ${businessName}</h2>
    <p>Services: ${(services ?? []).join(', ') || '—'}</p>
    <p>Budget range: ${budgetRange ?? '—'}</p>
    <p>Date: ${dateStr}</p>
  </div>
  ${bodyHtml}
  <div class="footer">Prepared by Tedmark Digital Agency &mdash; contact@tedmarkdigital.com</div>
</body>
</html>`;
}

export async function renderProposalPdf(proposal) {
  const html = buildHtml(proposal);
  let browser;

  try {
    browser = await chromium.launch();
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    const buffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', bottom: '0', left: '0', right: '0' },
    });
    return buffer;
  } finally {
    if (browser) await browser.close();
  }
}
