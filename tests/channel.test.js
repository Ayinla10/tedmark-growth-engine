import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { resolveChannel } from '../tools/channel.js';

describe('resolveChannel', () => {
  test('prefers email when present, even if a phone is also present', () => {
    assert.equal(resolveChannel({ email: 'owner@business.com', phone: '0244123456' }), 'email');
  });

  test('falls back to whatsapp for a genuine Ghanaian mobile number', () => {
    assert.equal(resolveChannel({ email: null, phone: '0244123456' }), 'whatsapp');
  });

  test('returns null for a landline with no email', () => {
    assert.equal(resolveChannel({ email: null, phone: '0301234567' }), null);
  });

  test('returns null when there is no usable contact info at all', () => {
    assert.equal(resolveChannel({ email: null, phone: null }), null);
    assert.equal(resolveChannel({ email: '', phone: '' }), null);
  });

  test('returns null for an unparseable phone number', () => {
    assert.equal(resolveChannel({ email: null, phone: '123' }), null);
  });
});
