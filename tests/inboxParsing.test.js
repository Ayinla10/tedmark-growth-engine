import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { extractSenderEmail, isAutomatedSender, stripQuotedReply } from '../tools/inboxParsing.js';

describe('extractSenderEmail', () => {
  test('extracts the email from a "Name <email>" from field', () => {
    assert.equal(extractSenderEmail('Acme Clinic <owner@acmeclinic.com>'), 'owner@acmeclinic.com');
  });

  test('extracts a bare email with no display name', () => {
    assert.equal(extractSenderEmail('owner@acmeclinic.com'), 'owner@acmeclinic.com');
  });

  test('lowercases the result', () => {
    assert.equal(extractSenderEmail('Owner@AcmeClinic.com'), 'owner@acmeclinic.com');
  });

  test('returns null when there is no field', () => {
    assert.equal(extractSenderEmail(''), null);
    assert.equal(extractSenderEmail(null), null);
  });
});

describe('isAutomatedSender', () => {
  test('flags mailer-daemon and postmaster addresses', () => {
    assert.equal(isAutomatedSender('mailer-daemon@server171.web-hosting.com'), true);
    assert.equal(isAutomatedSender('postmaster@tedmarkdigital.com'), true);
  });

  test('flags noreply addresses', () => {
    assert.equal(isAutomatedSender('noreply@somesystem.com'), true);
    assert.equal(isAutomatedSender('no-reply@somesystem.com'), true);
  });

  test('does not flag a normal lead email', () => {
    assert.equal(isAutomatedSender('owner@acmeclinic.com'), false);
  });

  test('flags a missing email as automated (nothing to match, safest to skip)', () => {
    assert.equal(isAutomatedSender(null), true);
  });
});

describe('stripQuotedReply', () => {
  test('cuts off an "On ... wrote:" quoted chain', () => {
    const text = "Sure, tell me more.\n\nOn Mon, Jan 5, 2026 at 3:00 PM Ayinla wrote:\n> Hi there, following up...";
    assert.equal(stripQuotedReply(text), 'Sure, tell me more.');
  });

  test('cuts off an "On ... wrote:" chain even when Gmail wraps it across a line break', () => {
    const text = "Yes im interested\n\nOn Mon, Jul 13, 2026 at 2:25 PM Romaric Romaric <romaricromaric99@gmail.com>\nwrote:\n\n> yes, resend is working\n";
    assert.equal(stripQuotedReply(text), 'Yes im interested');
  });

  test('cuts off an Outlook-style "Original Message" chain', () => {
    const text = "No thanks.\n\n-----Original Message-----\nFrom: Ayinla\nSent: ...";
    assert.equal(stripQuotedReply(text), 'No thanks.');
  });

  test('returns the full text unchanged when there is no quoted chain', () => {
    assert.equal(stripQuotedReply('Just a plain reply, nothing quoted.'), 'Just a plain reply, nothing quoted.');
  });

  test('handles empty input', () => {
    assert.equal(stripQuotedReply(''), '');
    assert.equal(stripQuotedReply(null), '');
  });
});
