/**
 * Connector API Tests
 *
 * Tests connector listing, installation, and credential management.
 * Run with: npm test
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { existsSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

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
// Connector Listing
// ============================================================================

describe('Connector Listing', () => {

  it('should return connectors list', async () => {
    const res = await request('/api/connectors');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert(Array.isArray(res.data.connectors), 'connectors should be an array');
  });

  it('should include connector status and lastSync', async () => {
    const res = await request('/api/connectors');
    assert.strictEqual(res.status, 200);

    if (res.data.connectors.length > 0) {
      const connector = res.data.connectors[0];
      assert('status' in connector, 'connector should have status');
      assert('lastSync' in connector, 'connector should have lastSync');
      assert('id' in connector, 'connector should have id');
      assert('name' in connector, 'connector should have name');
    }
  });

});

// ============================================================================
// Connector Installation
// ============================================================================

describe('Connector Installation', () => {

  it('should reject install without connectorId', async () => {
    const res = await request('/api/connectors/install', {
      method: 'POST',
      body: {}
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.data.success, false);
    assert(res.data.error.includes('connectorId'), 'error should mention connectorId');
  });

  it('should return 404 for non-existent connector template', async () => {
    const res = await request('/api/connectors/install', {
      method: 'POST',
      body: { connectorId: 'nonexistent-connector-xyz' }
    });
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.data.success, false);
  });

});

// ============================================================================
// Environment Variable Saving
// ============================================================================

describe('Environment Variable Saving', () => {

  it('should reject save without vars object', async () => {
    const res = await request('/api/env/save', {
      method: 'POST',
      body: {}
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.data.success, false);
  });

  it('should reject save with non-object vars', async () => {
    const res = await request('/api/env/save', {
      method: 'POST',
      body: { vars: 'not-an-object' }
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.data.success, false);
  });

  it('should save environment variables', async () => {
    const testVar = `TEST_VAR_${Date.now()}`;
    const res = await request('/api/env/save', {
      method: 'POST',
      body: { vars: { [testVar]: 'test-value' } }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
  });

});

// ============================================================================
// Data Sources
// ============================================================================

describe('Data Sources', () => {

  it('should return data sources', async () => {
    const res = await request('/api/datasources');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert('sources' in res.data, 'response should have sources');
  });

});
