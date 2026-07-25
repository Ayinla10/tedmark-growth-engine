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

  test('detects a chat widget from Zendesk, Freshchat, or LiveChat', () => {
    assert.equal(detectSiteSignals({ html: '<script src="https://acme.zdassets.com/widget.js"></script>' }).hasChatWidget, true);
    assert.equal(detectSiteSignals({ html: '<script src="https://wchat.freshchat.com/embed.js"></script>' }).hasChatWidget, true);
    assert.equal(detectSiteSignals({ html: '<script src="https://cdn.livechatinc.com/tracking.js"></script>' }).hasChatWidget, true);
  });

  test('detects WordPress from wp-content paths', () => {
    const signals = detectSiteSignals({ html: '<link rel="stylesheet" href="/wp-content/themes/acme/style.css">' });
    assert.equal(signals.cms, 'WordPress');
  });

  test('detects Wix, Squarespace, and Webflow from their asset hosts', () => {
    assert.equal(detectSiteSignals({ html: '<script src="https://static.wixstatic.com/x.js"></script>' }).cms, 'Wix');
    assert.equal(detectSiteSignals({ html: '<link href="https://static1.squarespace.com/x.css">' }).cms, 'Squarespace');
    assert.equal(detectSiteSignals({ html: '<script src="https://assets-global.website-files.com/x.js"></script>' }).cms, 'Webflow');
  });

  test('flags Joomla as looksOutdated even with modern signals otherwise present', () => {
    const signals = detectSiteSignals({
      html: '<meta name="generator" content="Joomla! - Open Source Content Management"><script>gtag("config")</script>',
      bodyText: 'Welcome. Book now. © 2026 Acme.',
      hasViewportMeta: true,
      hasH1: true,
    });
    assert.equal(signals.cms, 'Joomla');
    assert.equal(signals.looksOutdated, true);
  });

  test('returns null cms when no known platform is detected', () => {
    const signals = detectSiteSignals({ html: '<p>Hand-rolled static HTML.</p>' });
    assert.equal(signals.cms, null);
  });

  test('detects a blog/news section', () => {
    assert.equal(detectSiteSignals({ html: '<a href="/blog">Blog</a>' }).hasBlog, true);
    assert.equal(detectSiteSignals({ html: '<a href="/news">News</a>' }).hasBlog, true);
    assert.equal(detectSiteSignals({ html: '<p>No such section here.</p>' }).hasBlog, false);
  });

  test('passes through hasSsl unchanged (computed by the caller from the page URL)', () => {
    assert.equal(detectSiteSignals({ hasSsl: true }).hasSsl, true);
    assert.equal(detectSiteSignals({ hasSsl: false }).hasSsl, false);
    assert.equal(detectSiteSignals({}).hasSsl, null);
  });
});
