import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { resolveSectorSlugs, cleanPhone, extractSocialUrl, normalizeListing } from '../tools/directoryParsing.js';

describe('resolveSectorSlugs', () => {
  test('resolves known sectors to their real BusinessGhana category slugs', () => {
    assert.deepEqual(resolveSectorSlugs('restaurant'), ['caterers']);
    assert.deepEqual(resolveSectorSlugs('clinic'), ['clinic', 'hospital']);
    assert.deepEqual(resolveSectorSlugs('real estate'), ['real-estate-brokers-agents']);
  });

  test('is case-insensitive and trims whitespace', () => {
    assert.deepEqual(resolveSectorSlugs('  Restaurant  '), ['caterers']);
  });

  test('returns an empty array for a sector with no clean directory mapping (e.g. logistics)', () => {
    assert.deepEqual(resolveSectorSlugs('logistics'), []);
  });

  test('returns an empty array for an unrecognized sector', () => {
    assert.deepEqual(resolveSectorSlugs('something made up'), []);
  });
});

describe('cleanPhone', () => {
  test('keeps only the first phone number when several are pipe-separated', () => {
    assert.equal(cleanPhone('0244487089|  Facebook link: https://www.facebook.com/GoldiesSnS/'), '0244487089');
  });

  test('returns the phone unchanged when there is only one', () => {
    assert.equal(cleanPhone('+233 244254852'), '+233 244254852');
  });

  test('returns null for empty input', () => {
    assert.equal(cleanPhone(''), null);
    assert.equal(cleanPhone(null), null);
  });
});

describe('extractSocialUrl', () => {
  test('extracts a Facebook link embedded in mixed phone/social text', () => {
    assert.equal(
      extractSocialUrl('0244487089|  Facebook link: https://www.facebook.com/GoldiesSnS/'),
      'https://www.facebook.com/GoldiesSnS/'
    );
  });

  test('returns null when there is no social link present', () => {
    assert.equal(extractSocialUrl('0244487089'), null);
  });
});

describe('normalizeListing', () => {
  test('builds a clean candidate from a raw scraped listing', () => {
    const result = normalizeListing({
      name: '  Goldie\'s Sweets and Savouries  ',
      description: 'We are a catering company...',
      phoneRaw: '0244487089|  Facebook link: https://www.facebook.com/GoldiesSnS/',
      location: 'Tarkwa',
      detailPath: '/site/directory/caterers/123/Goldies',
    });

    assert.equal(result.businessName, "Goldie's Sweets and Savouries");
    assert.equal(result.phone, '0244487089');
    assert.equal(result.socialUrl, 'https://www.facebook.com/GoldiesSnS/');
    assert.equal(result.location, 'Tarkwa');
    assert.equal(result.detailUrl, 'https://www.businessghana.com/site/directory/caterers/123/Goldies');
  });

  test('returns null when the listing has no usable name', () => {
    assert.equal(normalizeListing({ name: '', description: 'x' }), null);
    assert.equal(normalizeListing({}), null);
  });
});
