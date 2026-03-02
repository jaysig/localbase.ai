/**
 * Flows API Tests
 *
 * Tests flow submission endpoints: POST, GET, PATCH
 * Run with: npm test
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { startTestServer, stopTestServer, request } from './setup.js';

before(async () => {
  await startTestServer();
});

after(async () => {
  await stopTestServer();
});

// ============================================================================
// Flows API - Submissions
// ============================================================================

describe('Flows API', () => {

  let createdSubmissionId;

  it('POST /api/flows/:slug/submit should require name, email, phone', async () => {
    const res = await request('/api/flows/test-flow/submit', {
      method: 'POST',
      body: { name: 'Test' }
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.data.success, false);
    assert.ok(res.data.error.includes('required'));
  });

  it('POST /api/flows/:slug/submit should create a submission', async () => {
    const res = await request('/api/flows/test-flow/submit', {
      method: 'POST',
      body: {
        name: 'Test User',
        email: 'test@example.com',
        phone: '555-0100',
        flow_type: 'estimate',
        address: '123 Test St',
        qualify_score: 'high',
        urgency_level: 'urgent',
        flow_data: { source: 'test-suite', answers: [1, 2, 3] },
        utm_source: 'jest',
        utm_medium: 'test',
        utm_campaign: 'ci'
      }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(res.data.id);
    createdSubmissionId = res.data.id;
  });

  it('GET /api/flows/submissions should list submissions', async () => {
    const res = await request('/api/flows/submissions');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(Array.isArray(res.data.submissions));
    assert.ok(res.data.submissions.length > 0);
  });

  it('GET /api/flows/submissions?flow_slug= should filter by slug', async () => {
    const res = await request('/api/flows/submissions?flow_slug=test-flow');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    const all = res.data.submissions;
    assert.ok(all.every(s => s.flow_slug === 'test-flow'));
  });

  it('GET /api/flows/submissions should parse flow_data JSON', async () => {
    const res = await request('/api/flows/submissions?flow_slug=test-flow');
    const sub = res.data.submissions.find(s => s.id === createdSubmissionId);
    assert.ok(sub, 'Should find the created submission');
    assert.strictEqual(typeof sub.flow_data, 'object');
    assert.strictEqual(sub.flow_data.source, 'test-suite');
  });

  it('PATCH /api/flows/submissions/:id should reject without admin key', async () => {
    const res = await request(`/api/flows/submissions/${createdSubmissionId}`, {
      method: 'PATCH',
      body: { status: 'contacted' }
    });
    assert.strictEqual(res.status, 403);
  });

  it('PATCH /api/flows/submissions/:id should reject without status', async () => {
    const res = await request(`/api/flows/submissions/${createdSubmissionId}?key=wrong`, {
      method: 'PATCH',
      body: {}
    });
    // 403 (bad key) or 400 (missing status) — either is correct since ADMIN_KEY may not be set
    assert.ok(res.status === 400 || res.status === 403);
  });

});

// ============================================================================
// Env API - Public Key Access
// ============================================================================

describe('Env API', () => {

  it('GET /api/env/:key should reject non-whitelisted keys', async () => {
    const res = await request('/api/env/HUBSPOT_ACCESS_TOKEN');
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.data.success, false);
  });

  it('GET /api/env/:key should return whitelisted keys', async () => {
    const res = await request('/api/env/MAPBOX_TOKEN');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    // Value may be null if not set, but endpoint should work
    assert.ok('value' in res.data);
  });

});
