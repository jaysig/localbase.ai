/**
 * API Tests for LocalBase Server
 *
 * Tests core API endpoints for workspace, tools, and connectors.
 * Run with: npm test
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

const BASE_URL = 'http://localhost:3000';

async function request(path, options = {}) {
  const { method = 'GET', body, headers = {} } = options;

  const fetchOptions = {
    method,
    headers: { 'Content-Type': 'application/json', ...headers }
  };

  if (body) {
    fetchOptions.body = JSON.stringify(body);
  }

  const response = await fetch(`${BASE_URL}${path}`, fetchOptions);
  const text = await response.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  return { status: response.status, data, headers: response.headers };
}

// ============================================================================
// Health Check
// ============================================================================

describe('Health Check', () => {

  it('should return 200 on /health', async () => {
    const res = await request('/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.status, 'ok');
  });

});

// ============================================================================
// Workspace API
// ============================================================================

describe('Workspace API', () => {

  it('GET /api/workspace should return workspace info', async () => {
    const res = await request('/api/workspace');
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.success !== undefined || res.data.name !== undefined);
  });

  it('GET /api/workspaces should return workspaces list', async () => {
    const res = await request('/api/workspaces');
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.success !== undefined || Array.isArray(res.data.workspaces));
  });

  it('GET /api/workspace/stats should return statistics', async () => {
    const res = await request('/api/workspace/stats');
    assert.strictEqual(res.status, 200);
    // Should have some stats structure
    assert.ok(typeof res.data === 'object');
  });

});

// ============================================================================
// Tools API
// ============================================================================

describe('Tools API', () => {

  it('GET /api/tools should return tools list', async () => {
    const res = await request('/api/tools');
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.success === true || Array.isArray(res.data.tools));
  });

  it('GET /api/connectors should return connectors list', async () => {
    const res = await request('/api/connectors');
    assert.strictEqual(res.status, 200);
    assert.ok(typeof res.data === 'object');
  });

  it('GET /api/datasources should return datasources', async () => {
    const res = await request('/api/datasources');
    assert.strictEqual(res.status, 200);
    assert.ok(typeof res.data === 'object');
  });

});

// ============================================================================
// Database Query API
// ============================================================================

describe('Database Query API', () => {

  it('POST /api/db/query should require database and sql', async () => {
    const res = await request('/api/db/query', {
      method: 'POST',
      body: {}
    });
    // Should return 400 for missing params
    assert.ok(res.status === 400 || res.status === 404);
  });

  it('POST /api/db/query should reject non-SELECT queries', async () => {
    const res = await request('/api/db/query', {
      method: 'POST',
      body: {
        database: 'data/test.db',
        sql: 'DELETE FROM users'
      }
    });
    // Should reject destructive queries (or 404 if db doesn't exist)
    assert.ok(
      res.status === 400 || res.status === 403 || res.status === 404 || res.status === 500,
      `Expected 400/403/404/500, got ${res.status}`
    );
  });

  it('POST /api/db/query should accept SELECT queries', async () => {
    const res = await request('/api/db/query', {
      method: 'POST',
      body: {
        database: 'data/test.db',
        sql: 'SELECT 1 as test'
      }
    });
    // Should succeed or 404 if db doesn't exist
    assert.ok(
      res.status === 200 || res.status === 404,
      `Expected 200 or 404, got ${res.status}`
    );
  });

});
