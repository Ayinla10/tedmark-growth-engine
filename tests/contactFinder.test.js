import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeGhanaPhone } from '../tools/contactFinder.js';

describe('normalizeGhanaPhone', () => {
  test('returns null for empty/missing input', () => {
    assert.equal(normalizeGhanaPhone(null), null);
    assert.equal(normalizeGhanaPhone(undefined), null);
    assert.equal(normalizeGhanaPhone(''), null);
  });

  test('normalizes a local 0-prefixed number', () => {
    const result = normalizeGhanaPhone('0244123456');
    assert.equal(result.e164, '+233244123456');
    assert.equal(result.isMobile, true);
    assert.equal(result.waLink, 'https://wa.me/233244123456');
  });

  test('normalizes a number already in +233 / 233 form', () => {
    assert.equal(normalizeGhanaPhone('+233244123456').e164, '+233244123456');
    assert.equal(normalizeGhanaPhone('233244123456').e164, '+233244123456');
  });

  test('strips non-digit formatting (spaces, dashes)', () => {
    const result = normalizeGhanaPhone('024 412-3456');
    assert.equal(result.e164, '+233244123456');
  });

  test('flags a genuine mobile prefix as isMobile', () => {
    for (const prefix of ['20', '24', '27', '54', '59']) {
      const result = normalizeGhanaPhone(`0${prefix}1234567`);
      assert.equal(result.isMobile, true, `expected ${prefix} to be mobile`);
    }
  });

  test('flags a landline-style prefix as not mobile', () => {
    // Ghana landlines commonly start with 03 (e.g. 030 for Accra area codes)
    const result = normalizeGhanaPhone('0301234567');
    assert.equal(result.isMobile, false);
  });

  test('rejects numbers with the wrong digit count', () => {
    assert.equal(normalizeGhanaPhone('123'), null);
    assert.equal(normalizeGhanaPhone('02441234567890'), null);
  });
});
