import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhone } from '../tools/contactFinder.js';

describe('normalizePhone (Ghana, default)', () => {
  test('returns null for empty/missing input', () => {
    assert.equal(normalizePhone(null), null);
    assert.equal(normalizePhone(undefined), null);
    assert.equal(normalizePhone(''), null);
  });

  test('normalizes a local 0-prefixed number', () => {
    const result = normalizePhone('0244123456');
    assert.equal(result.e164, '+233244123456');
    assert.equal(result.isMobile, true);
    assert.equal(result.waLink, 'https://wa.me/233244123456');
  });

  test('normalizes a number already in +233 / 233 form', () => {
    assert.equal(normalizePhone('+233244123456').e164, '+233244123456');
    assert.equal(normalizePhone('233244123456').e164, '+233244123456');
  });

  test('strips non-digit formatting (spaces, dashes)', () => {
    const result = normalizePhone('024 412-3456');
    assert.equal(result.e164, '+233244123456');
  });

  test('flags a genuine mobile prefix as isMobile', () => {
    for (const prefix of ['20', '24', '27', '54', '59']) {
      const result = normalizePhone(`0${prefix}1234567`);
      assert.equal(result.isMobile, true, `expected ${prefix} to be mobile`);
    }
  });

  test('flags a landline-style prefix as not mobile', () => {
    // Ghana landlines commonly start with 03 (e.g. 030 for Accra area codes)
    const result = normalizePhone('0301234567');
    assert.equal(result.isMobile, false);
  });

  test('rejects numbers with the wrong digit count', () => {
    assert.equal(normalizePhone('123'), null);
    assert.equal(normalizePhone('02441234567890'), null);
  });

  test('defaults to Ghana when no country code is given', () => {
    assert.equal(normalizePhone('0244123456').e164, '+233244123456');
  });
});

describe('normalizePhone (other countries)', () => {
  test('normalizes a Nigerian mobile number', () => {
    const result = normalizePhone('08031234567', 'NG');
    assert.equal(result.e164, '+2348031234567');
    assert.equal(result.isMobile, true);
    assert.equal(result.waLink, 'https://wa.me/2348031234567');
  });

  test('normalizes a Nigerian number already in +234 form', () => {
    assert.equal(normalizePhone('+2348031234567', 'NG').e164, '+2348031234567');
  });

  test('normalizes a Kenyan mobile number', () => {
    const result = normalizePhone('0712345678', 'KE');
    assert.equal(result.e164, '+254712345678');
    assert.equal(result.isMobile, true);
  });

  test("normalizes a Côte d'Ivoire mobile number", () => {
    const result = normalizePhone('0701234567', 'CI');
    assert.equal(result.e164, '+2250701234567');
    assert.equal(result.isMobile, true);
  });

  test('normalizes a Senegalese mobile number', () => {
    const result = normalizePhone('0771234567', 'SN');
    assert.equal(result.e164, '+221771234567');
    assert.equal(result.isMobile, true);
  });

  test('rejects a number with the wrong digit count for its country', () => {
    // 9 digits is valid for Ghana but not Nigeria (10 digits)
    assert.equal(normalizePhone('0244123456', 'NG'), null);
  });

  test('falls back to Ghana rules for an unknown country code', () => {
    assert.equal(normalizePhone('0244123456', 'ZZ').e164, '+233244123456');
  });
});
