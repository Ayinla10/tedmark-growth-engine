import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { resolveSectorCategory } from '../tools/mapsClient.js';

describe('resolveSectorCategory', () => {
  test('resolves known sectors to their Geoapify category', () => {
    assert.equal(resolveSectorCategory('restaurant'), 'catering.restaurant');
    assert.equal(resolveSectorCategory('clinic'), 'healthcare.clinic_or_praxis');
    assert.equal(resolveSectorCategory('real estate'), 'office.estate_agent');
  });

  test('is case-insensitive and trims whitespace', () => {
    assert.equal(resolveSectorCategory('  Restaurant  '), 'catering.restaurant');
    assert.equal(resolveSectorCategory('CLINIC'), 'healthcare.clinic_or_praxis');
  });

  test('returns null for a sector with no clean category mapping (e.g. event planning)', () => {
    assert.equal(resolveSectorCategory('event planning'), null);
  });

  test('returns null for any unrecognized sector rather than defaulting to a generic category', () => {
    assert.equal(resolveSectorCategory('something made up'), null);
  });
});
