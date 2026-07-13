import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildQueries,
  cleanBusinessName,
  extractEmailFromResult,
  extractWebsiteFromSnippet,
  isSocialResult,
  resolveCandidate,
} from '../tools/searchQueries.js';

describe('buildQueries', () => {
  test('builds one web-contact, one web-email, one linkedin, one facebook query per sector/city', () => {
    const queries = buildQueries('school', 'Accra');
    assert.equal(queries.length, 4);
    const types = queries.map((q) => q.type);
    assert.deepEqual(types.filter((t) => t === 'web').length, 2);
    assert.ok(types.includes('linkedin'));
    assert.ok(types.includes('facebook'));
    assert.ok(queries.every((q) => q.query.includes('school') && q.query.includes('Accra')));
  });

  test('combines many email prefixes into a single OR-grouped query instead of one query per prefix', () => {
    const queries = buildQueries('clinic', 'Kumasi');
    const emailQuery = queries.find((q) => q.query.includes('info@'));
    assert.ok(emailQuery, 'expected a query containing info@');
    // Confirms several common prefixes are covered by this one query.
    for (const prefix of ['info@', 'contact@', 'sales@', 'admin@', 'hello@', 'support@', 'enquiries@', 'bookings@']) {
      assert.ok(emailQuery.query.includes(prefix), `expected query to include ${prefix}`);
    }
  });

  test('linkedin/facebook queries only ever target the index of those sites, never a raw crawl', () => {
    const queries = buildQueries('clinic', 'Kumasi');
    const linkedin = queries.find((q) => q.type === 'linkedin');
    const facebook = queries.find((q) => q.type === 'facebook');
    assert.match(linkedin.query, /^site:linkedin\.com\/company/);
    assert.match(facebook.query, /^site:facebook\.com/);
  });
});

describe('isSocialResult', () => {
  test('flags linkedin and facebook links', () => {
    assert.equal(isSocialResult('https://www.linkedin.com/company/acme'), true);
    assert.equal(isSocialResult('https://www.facebook.com/acmepage'), true);
  });

  test('does not flag a normal business website', () => {
    assert.equal(isSocialResult('https://acmebusiness.com/contact'), false);
  });
});

describe('extractWebsiteFromSnippet', () => {
  test('returns null when there is no URL in the snippet', () => {
    assert.equal(extractWebsiteFromSnippet('Great clinic in Accra, friendly staff.'), null);
  });

  test('extracts a real business URL from the snippet text', () => {
    assert.equal(extractWebsiteFromSnippet('Visit us at https://acmeclinic.com.gh for bookings.'), 'https://acmeclinic.com.gh');
  });

  test('ignores a social-media URL mentioned inside the snippet', () => {
    assert.equal(extractWebsiteFromSnippet('Follow us at https://facebook.com/acmeclinic for updates.'), null);
  });

  test('strips trailing punctuation picked up by the regex', () => {
    assert.equal(extractWebsiteFromSnippet('See https://acmeclinic.com.'), 'https://acmeclinic.com');
  });
});

describe('extractEmailFromResult', () => {
  test('finds a real email in the snippet', () => {
    const email = extractEmailFromResult({ title: 'Acme Clinic', snippet: 'Reach us at info@acmeclinic.com for bookings.' });
    assert.equal(email, 'info@acmeclinic.com');
  });

  test('finds an email in the title if present there instead', () => {
    const email = extractEmailFromResult({ title: 'Contact: sales@acme.com.gh', snippet: '' });
    assert.equal(email, 'sales@acme.com.gh');
  });

  test('returns null when no email is present', () => {
    assert.equal(extractEmailFromResult({ title: 'Acme Clinic', snippet: 'A great clinic in Accra.' }), null);
  });

  test('filters out junk emails like noreply@ addresses', () => {
    assert.equal(extractEmailFromResult({ title: '', snippet: 'Contact noreply@acme.com for automated updates.' }), null);
  });
});

describe('cleanBusinessName', () => {
  test('keeps only the leading segment before a separator', () => {
    assert.equal(cleanBusinessName('Acme Clinic | Home'), 'Acme Clinic');
    assert.equal(cleanBusinessName('Acme Clinic - Contact Us'), 'Acme Clinic');
    assert.equal(cleanBusinessName('Acme Clinic — About'), 'Acme Clinic');
  });

  test('returns empty string for empty input', () => {
    assert.equal(cleanBusinessName(''), '');
    assert.equal(cleanBusinessName(undefined), '');
  });
});

describe('resolveCandidate', () => {
  test('uses the result link directly for a normal web result', () => {
    const candidate = resolveCandidate({ title: 'Acme Clinic | Home', link: 'https://acmeclinic.com', snippet: '' });
    assert.equal(candidate.businessName, 'Acme Clinic');
    assert.equal(candidate.website, 'https://acmeclinic.com');
    assert.equal(candidate.socialUrl, null);
  });

  test('pulls the website from the snippet for a LinkedIn result, and keeps the LinkedIn URL as the social handle', () => {
    const candidate = resolveCandidate({
      title: 'Acme Clinic - LinkedIn',
      link: 'https://linkedin.com/company/acme-clinic',
      snippet: 'Acme Clinic. Visit https://acmeclinic.com for more.',
    });
    assert.equal(candidate.website, 'https://acmeclinic.com');
    assert.equal(candidate.socialUrl, 'https://linkedin.com/company/acme-clinic');
  });

  test('is still a valid candidate from a LinkedIn result with an email but no website', () => {
    const candidate = resolveCandidate({
      title: 'Acme Clinic - LinkedIn',
      link: 'https://linkedin.com/company/acme-clinic',
      snippet: 'Healthcare company in Accra, Ghana. Email: info@acmeclinic.com',
    });
    assert.equal(candidate.website, null);
    assert.equal(candidate.email, 'info@acmeclinic.com');
    assert.equal(candidate.socialUrl, 'https://linkedin.com/company/acme-clinic');
  });

  test('returns null when there is neither a website nor an email to act on', () => {
    const candidate = resolveCandidate({
      title: 'Acme Clinic - LinkedIn',
      link: 'https://linkedin.com/company/acme-clinic',
      snippet: 'Healthcare company in Accra, Ghana.',
    });
    assert.equal(candidate, null);
  });

  test('returns null when the title yields no usable business name', () => {
    const candidate = resolveCandidate({ title: '', link: 'https://acmeclinic.com', snippet: '' });
    assert.equal(candidate, null);
  });
});
