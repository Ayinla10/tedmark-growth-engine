import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { detectSiteSignals } from '../tools/siteSignals.js';

describe('detectSiteSignals', () => {
  test('detects a modern, well-optimized site', () => {
    const signals = detectSiteSignals({
      html: '<script>gtag("config", "UA-1")</script>',
      bodyText: 'Welcome. Book now for a free consultation. © 2026 Acme.',
      hasViewportMeta: true,
      hasH1: true,
      hasMetaDescription: true,
    });
    assert.equal(signals.mobileFriendly, true);
    assert.equal(signals.hasTrackingPixel, true);
    assert.equal(signals.hasClearCta, true);
    assert.equal(signals.looksOutdated, false);
  });

  test('detects an outdated site with no viewport, no tracking, stale copyright', () => {
    const signals = detectSiteSignals({
      html: '<table><tr><td>Welcome</td></tr></table>',
      bodyText: 'Welcome to our business. Copyright 2015 Acme Corp.',
      hasViewportMeta: false,
      hasH1: false,
      hasMetaDescription: false,
    });
    assert.equal(signals.mobileFriendly, false);
    assert.equal(signals.hasTrackingPixel, false);
    assert.equal(signals.copyrightYear, 2015);
    assert.equal(signals.looksOutdated, true);
  });

  test('detects a booking system from known widget domains', () => {
    const signals = detectSiteSignals({
      html: '<iframe src="https://calendly.com/acme/consult"></iframe>',
      bodyText: '',
      hasViewportMeta: true,
      hasH1: true,
    });
    assert.equal(signals.hasBookingSystem, true);
  });

  test('does not flag a site as outdated just for missing one signal', () => {
    // Has tracking installed, so not "unmeasured" even without a viewport tag.
    const signals = detectSiteSignals({
      html: '<script src="https://www.googletagmanager.com/gtm.js"></script>',
      bodyText: 'Some content with an H1.',
      hasViewportMeta: false,
      hasH1: true,
      hasMetaDescription: true,
    });
    assert.equal(signals.looksOutdated, false);
  });

  test('returns null copyrightYear when none is found', () => {
    const signals = detectSiteSignals({ html: '', bodyText: 'No date info here.', hasViewportMeta: true, hasH1: true });
    assert.equal(signals.copyrightYear, null);
  });

  test('handles completely empty input without throwing', () => {
    const signals = detectSiteSignals({});
    assert.equal(signals.mobileFriendly, false);
    assert.equal(signals.hasTrackingPixel, false);
    assert.equal(signals.hasBookingSystem, false);
    assert.equal(signals.hasClearCta, false);
    assert.equal(signals.hasChatWidget, false);
    assert.equal(signals.hasEmailCapture, false);
    assert.equal(signals.hasSocialLinks, false);
    assert.equal(signals.hasEcommerce, false);
  });

  test('detects a chat widget from a known provider script', () => {
    const signals = detectSiteSignals({ html: '<script src="https://embed.tawk.to/abc123"></script>' });
    assert.equal(signals.hasChatWidget, true);
  });

  test('detects a chat widget from a WhatsApp click-to-chat link', () => {
    const signals = detectSiteSignals({ html: '<a href="https://wa.me/233201234567">Chat with us</a>' });
    assert.equal(signals.hasChatWidget, true);
  });

  test('detects email capture from an ESP script', () => {
    const signals = detectSiteSignals({ html: '<form action="https://acme.us1.list-manage.com/subscribe"></form>' });
    assert.equal(signals.hasEmailCapture, true);
  });

  test('detects email capture from newsletter keywords when no ESP script is present', () => {
    const signals = detectSiteSignals({ bodyText: 'Subscribe to our newsletter for updates.' });
    assert.equal(signals.hasEmailCapture, true);
  });

  test('detects social links', () => {
    const signals = detectSiteSignals({ html: '<a href="https://www.instagram.com/acmeclinic">Instagram</a>' });
    assert.equal(signals.hasSocialLinks, true);
  });

  test('detects e-commerce integration from a payment processor', () => {
    const signals = detectSiteSignals({ html: '<script src="https://js.paystack.com/v2/inline.js"></script>' });
    assert.equal(signals.hasEcommerce, true);
  });

  test('does not flag e-commerce or social when none are present', () => {
    const signals = detectSiteSignals({ html: '<p>Just a plain page.</p>', bodyText: 'Welcome to Acme.' });
    assert.equal(signals.hasEcommerce, false);
    assert.equal(signals.hasSocialLinks, false);
  });
});
