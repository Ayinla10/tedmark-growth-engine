import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBusinessName, isSameLocation } from '../tools/leadMatching.js';

describe('normalizeBusinessName', () => {
  test('lowercases and trims', () => {
    assert.equal(normalizeBusinessName('  Acme Clinic  '), 'acme clinic');
  });

  test('strips common business suffixes', () => {
    assert.equal(normalizeBusinessName('Acme Ltd'), 'acme');
    assert.equal(normalizeBusinessName('Acme Limited'), 'acme');
    assert.equal(normalizeBusinessName('Acme Ghana'), 'acme');
    assert.equal(normalizeBusinessName('Acme Gh'), 'acme');
    assert.equal(normalizeBusinessName('Acme Inc.'), 'acme');
    assert.equal(normalizeBusinessName('Acme Co'), 'acme');
  });

  test('two names differing only by suffix normalize to the same value', () => {
    assert.equal(normalizeBusinessName('Van J Eye Care Ltd'), normalizeBusinessName('Van J Eye Care'));
  });

  test('handles empty input', () => {
    assert.equal(normalizeBusinessName(''), '');
    assert.equal(normalizeBusinessName(null), '');
  });
});

describe('isSameLocation', () => {
  test('exact match (case-insensitive)', () => {
    assert.equal(isSameLocation('Accra', 'accra'), true);
  });

  test('a full formatted address containing the city counts as the same location', () => {
    assert.equal(isSameLocation('123 Ring Road, Accra, Ghana', 'Accra'), true);
    assert.equal(isSameLocation('Accra', '123 Ring Road, Accra, Ghana'), true);
  });

  test('different cities do not match', () => {
    assert.equal(isSameLocation('Kumasi', 'Accra'), false);
  });

  test('returns false when either side is missing', () => {
    assert.equal(isSameLocation(null, 'Accra'), false);
    assert.equal(isSameLocation('Accra', undefined), false);
  });
});
