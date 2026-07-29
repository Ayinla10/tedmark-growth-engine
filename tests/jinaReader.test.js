import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildReaderUrl } from '../tools/jinaReader.js';

describe('buildReaderUrl', () => {
  test('prepends the Jina Reader endpoint to a target URL', () => {
    assert.equal(buildReaderUrl('https://example.com'), 'https://r.jina.ai/https://example.com');
  });
});
