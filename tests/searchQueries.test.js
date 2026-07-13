import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildQueries,
  cleanBusinessName,
  extractWebsiteFromSnippet,
  isSocialResult,
  resolveCandidate,
} from '../tools/searchQueries.js';

describe('buildQueries', () => {
  test('builds one web, one linkedin, one facebook query per sector/city', () => {
    const queries = buildQueries('school', 'Accra');
    const types = queries.map((q) => q.type);
    assert.ok(types.includes('web'));
    assert.ok(types.includes('linkedin'));
    assert.ok(types.includes('facebook'));
    assert.ok(queries.every((q) => q.query.includes('school') && q.query.includes('Accra')));
  });

  test('linkedin/facebook queries only ever target Google\'s index of those sites, never a raw crawl', () => {
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
    assert.deepEqual(candidate, { businessName: 'Acme Clinic', website: 'https://acmeclinic.com' });
  });

  test('pulls the website from the snippet for a LinkedIn result', () => {
    const candidate = resolveCandidate({
      title: 'Acme Clinic - LinkedIn',
      link: 'https://linkedin.com/company/acme-clinic',
      snippet: 'Acme Clinic. Visit https://acmeclinic.com for more.',
    });
    assert.deepEqual(candidate, { businessName: 'Acme Clinic', website: 'https://acmeclinic.com' });
  });

  test('returns null for a LinkedIn result with no real website in the snippet', () => {
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
