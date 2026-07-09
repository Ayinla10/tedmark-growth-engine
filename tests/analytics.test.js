import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildSummary } from '../agents/analytics.js';

describe('buildSummary', () => {
  test('returns a neutral message when there is no data at all', () => {
    const summary = buildSummary({ sectors: [], channels: [], funnel: { totalLeads: 0, qualifyRate: null, contactRate: null } });
    assert.equal(summary, 'Not enough data yet to surface meaningful trends.');
  });

  test('calls out the top-scoring sector', () => {
    const summary = buildSummary({
      sectors: [{ sector: 'clinic', total: 39, avg_score: 9.6, contacted: 1 }],
      channels: [],
      funnel: { totalLeads: 100, qualifyRate: 50, contactRate: null },
    });
    assert.match(summary, /clinic leads score highest so far \(avg 9\.6\/10 across 39 leads\)/);
  });

  test('reports the best channel only when a real (non-zero) reply rate exists', () => {
    const summary = buildSummary({
      sectors: [],
      channels: [
        { channel: 'email', sent: 10, replied: 2, replyRate: 20 },
        { channel: 'whatsapp', sent: 5, replied: 0, replyRate: 0 },
      ],
      funnel: { totalLeads: 0, qualifyRate: null, contactRate: null },
    });
    assert.match(summary, /Email is getting the best reply rate \(20%\)/);
  });

  test('does not claim a "best" channel when every reply rate is zero', () => {
    const summary = buildSummary({
      sectors: [],
      channels: [{ channel: 'email', sent: 10, replied: 0, replyRate: 0 }],
      funnel: { totalLeads: 0, qualifyRate: null, contactRate: null },
    });
    assert.match(summary, /No replies logged yet on sent outreach\./);
    assert.doesNotMatch(summary, /best reply rate/);
  });

  test('includes the contact rate when available', () => {
    const summary = buildSummary({
      sectors: [],
      channels: [],
      funnel: { totalLeads: 100, qualifyRate: 80, contactRate: 12.5 },
    });
    assert.match(summary, /12\.5% of qualified leads have been contacted so far\./);
  });
});
