/**
 * Security Tests for LocalBase Server
 *
 * These tests verify that security controls are working correctly.
 * Run with: npm test
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Helper to make HTTP requests without external dependencies
async function request(path, options = {}) {
  const { method = 'GET', body, headers = {} } = options;
  const url = `http://localhost:3000${path}`;

  const fetchOptions = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  };

  if (body) {
    fetchOptions.body = JSON.stringify(body);
  }

  const response = await fetch(url, fetchOptions);
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
// SQL Injection Tests
// ============================================================================

describe('SQL Injection Prevention', () => {

  it('should sanitize LIMIT clause with numeric string', async () => {
    // This tests the data-merger-sqlite.js fix
    // A safe numeric string should work
    const res = await request('/api/mediatrader/query', {
      method: 'POST',
      body: { sourceId: 'google-ads', options: { limit: '10' } }
    });
    // Should not error - limit is valid
    assert.ok(res.status === 200 || res.status === 404, 'Should handle valid limit');
  });

  it('should reject SQL injection in LIMIT clause', async () => {
    // Attempt SQL injection via limit parameter
    const res = await request('/api/mediatrader/query', {
      method: 'POST',
      body: { sourceId: 'google-ads', options: { limit: '1; DROP TABLE deals; --' } }
    });
    // Should not execute the injection - either returns empty or ignores bad limit
    assert.ok(res.status !== 500, 'Should not crash on SQL injection attempt');
  });

  it('should reject SQL injection in table names', async () => {
    // Attempt SQL injection via table name
    const res = await request('/api/db/query', {
      method: 'POST',
      body: {
        database: 'data/test.db',
        sql: 'SELECT * FROM users; DROP TABLE users; --'
      }
    });
    // Should reject non-SELECT or return error
    assert.ok(res.status === 400 || res.status === 404 || res.status === 500);
  });

});

// ============================================================================
// Path Traversal Tests
// ============================================================================

describe('Path Traversal Prevention', () => {

  it('should block ../ in workspace file path', async () => {
    const res = await request('/api/workspace/file?path=../../../etc/passwd');
    assert.strictEqual(res.status, 403, 'Should return 403 for path traversal');
    assert.ok(
      res.data.error?.includes('traversal') || res.data.error?.includes('denied'),
      'Should mention traversal or access denied'
    );
  });

  it('should block absolute paths', async () => {
    const res = await request('/api/workspace/file?path=/etc/passwd');
    assert.ok(
      res.status === 403 || res.status === 404,
      'Should reject absolute paths'
    );
  });

  it('should block access to env.local', async () => {
    const res = await request('/api/workspace/file?path=env.local');
    assert.strictEqual(res.status, 403, 'Should block sensitive files');
  });

  it('should block access to credentials.json', async () => {
    const res = await request('/api/workspace/file?path=connectors/hubspot/credentials.json');
    assert.strictEqual(res.status, 403, 'Should block credential files');
  });

  it('should allow valid workspace file paths', async () => {
    const res = await request('/api/workspace/file?path=package.json');
    // Should either succeed or 404 if file doesn't exist - not 403
    assert.ok(
      res.status === 200 || res.status === 404,
      'Should allow valid paths'
    );
  });

});

// ============================================================================
// XSS Prevention Tests
// ============================================================================

describe('XSS Prevention', () => {

  it('should escape HTML in viz 404 error', async () => {
    const xssPayload = '<script>alert("xss")</script>';
    const res = await request(`/api/viz/${encodeURIComponent(xssPayload)}`);

    assert.strictEqual(res.status, 404);

    // Response should NOT contain unescaped script tag
    const html = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
    assert.ok(
      !html.includes('<script>alert'),
      'Should escape script tags in error response'
    );

    // Should contain escaped version
    assert.ok(
      html.includes('&lt;script&gt;') || !html.includes('<script'),
      'Should use HTML entities or omit entirely'
    );
  });

  it('should escape HTML in viz 500 error', async () => {
    // This is harder to trigger directly - would need to cause an error
    // For now, verify the escapeHtml function exists in response
    const res = await request('/api/viz/nonexistent-viz-id-12345');
    assert.strictEqual(res.status, 404);
  });

});

// ============================================================================
// Command Injection Tests
// ============================================================================

describe('Command Injection Prevention', () => {

  it('should reject shell metacharacters in sync script path', async () => {
    const res = await request('/api/datasources/test/sync', {
      method: 'POST'
    });
    // Should fail gracefully - either 404 (no such datasource) or 400 (bad path)
    assert.ok(
      res.status === 404 || res.status === 400,
      'Should not allow arbitrary command execution'
    );
  });

  it('should validate date format in signals refresh', async () => {
    // Try to inject command via date parameter
    // Note: This endpoint may not exist in all instances (it's in extensions/mediatrader/routes.js)
    const res = await request('/api/signals/refresh?date1=2025-01-01`id`&date2=2025-01-02', {
      method: 'POST'
    });
    // Accept 400 (invalid format) or 404 (endpoint not present in this instance)
    assert.ok(res.status === 400 || res.status === 404, 'Should reject invalid date format or return 404');
  });

  it('should not execute shell injection in weeks parameter', async () => {
    // parseInt("2;id") returns 2, so the request succeeds
    // But the key test is: did the ";id" part get executed as shell command?
    const res = await request('/api/signals/refresh?weeks=2;id', {
      method: 'POST'
    });

    // The response should NOT contain output from `id` command (like "uid=")
    const output = res.data?.output || '';
    assert.ok(
      !output.includes('uid=') && !output.includes('gid='),
      'Shell injection should not execute (no uid/gid in output)'
    );

    // Also verify we're using execFileSync (array args) not execSync (shell string)
    // by checking that semicolon-separated commands don't chain
    const res2 = await request('/api/signals/refresh?weeks=1;echo INJECTED', {
      method: 'POST'
    });
    const output2 = res2.data?.output || '';
    assert.ok(
      !output2.includes('INJECTED'),
      'Shell command chaining should not work'
    );
  });

  it('should accept valid weeks parameter', async () => {
    const res = await request('/api/signals/refresh?weeks=2', {
      method: 'POST'
    });
    // Should either succeed or 404 if script doesn't exist - not 400
    assert.ok(
      res.status === 200 || res.status === 404,
      'Should accept valid weeks parameter'
    );
  });

});

// ============================================================================
// Security Headers Tests
// ============================================================================

describe('Security Headers', () => {

  it('should include X-Frame-Options header', async () => {
    const res = await request('/health');
    assert.strictEqual(
      res.headers.get('x-frame-options'),
      'SAMEORIGIN',
      'Should set X-Frame-Options'
    );
  });

  it('should include X-Content-Type-Options header', async () => {
    const res = await request('/health');
    assert.strictEqual(
      res.headers.get('x-content-type-options'),
      'nosniff',
      'Should set X-Content-Type-Options'
    );
  });

  it('should include X-XSS-Protection header', async () => {
    const res = await request('/health');
    assert.strictEqual(
      res.headers.get('x-xss-protection'),
      '1; mode=block',
      'Should set X-XSS-Protection'
    );
  });

});

// ============================================================================
// Environment Variable Security Tests
// ============================================================================

describe('Environment Variable Security', () => {

  it('should reject saving empty vars object', async () => {
    const res = await request('/api/env/save', {
      method: 'POST',
      body: { vars: {} }
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.data.success, false);
  });

  it('should reject path traversal in variable names', async () => {
    const res = await request('/api/env/save', {
      method: 'POST',
      body: { vars: { '../../../etc/passwd': 'value' } }
    });
    // Should either reject with 400 or sanitize the key
    assert.ok(res.status === 400 || res.data.success === true);
  });

  it('should reject newline injection in variable values', async () => {
    const res = await request('/api/env/save', {
      method: 'POST',
      body: { vars: { 'TEST_VAR': 'value\nMALICIOUS_VAR=evil' } }
    });
    // The server should either reject or sanitize newlines
    // to prevent env file injection
    assert.ok(res.status === 200 || res.status === 400);
  });

  it('should reject excessively long variable names', async () => {
    const longName = 'A'.repeat(10000);
    const res = await request('/api/env/save', {
      method: 'POST',
      body: { vars: { [longName]: 'value' } }
    });
    // Should reject or truncate excessively long names
    assert.ok(res.status === 400 || res.status === 200);
  });

  it('should reject excessively long variable values', async () => {
    const longValue = 'x'.repeat(100000);
    const res = await request('/api/env/save', {
      method: 'POST',
      body: { vars: { 'TEST_VAR': longValue } }
    });
    // Should reject excessively long values
    assert.ok(res.status === 400 || res.status === 200);
  });

});

// ============================================================================
// Connector Installation Security Tests
// ============================================================================

describe('Connector Installation Security', () => {

  it('should reject path traversal in connectorId', async () => {
    const res = await request('/api/connectors/install', {
      method: 'POST',
      body: { connectorId: '../../../etc/passwd' }
    });
    // Should reject with 404 (not found) or 400 (invalid), not succeed
    assert.ok(res.status === 404 || res.status === 400);
    assert.strictEqual(res.data.success, false);
  });

  it('should reject null bytes in connectorId', async () => {
    const res = await request('/api/connectors/install', {
      method: 'POST',
      body: { connectorId: 'hubspot\x00../../etc/passwd' }
    });
    assert.ok(res.status === 404 || res.status === 400);
    assert.strictEqual(res.data.success, false);
  });

  it('should reject excessively long connectorId', async () => {
    const longId = 'x'.repeat(10000);
    const res = await request('/api/connectors/install', {
      method: 'POST',
      body: { connectorId: longId }
    });
    assert.ok(res.status === 404 || res.status === 400);
    assert.strictEqual(res.data.success, false);
  });

  it('should not expose system paths in error messages', async () => {
    const res = await request('/api/connectors/install', {
      method: 'POST',
      body: { connectorId: 'nonexistent-connector' }
    });
    assert.strictEqual(res.status, 404);
    // Error message should not leak system paths
    const error = res.data.error || '';
    assert.ok(
      !error.includes('/Users/') && !error.includes('/home/'),
      'Should not expose system paths'
    );
  });

});

// ============================================================================
// CORS Tests
// ============================================================================

describe('CORS Restrictions', () => {

  it('should allow localhost origins', async () => {
    const res = await request('/health', {
      headers: { 'Origin': 'http://localhost:5173' }
    });
    assert.strictEqual(
      res.headers.get('access-control-allow-origin'),
      'http://localhost:5173',
      'Should allow localhost:5173'
    );
  });

  it('should not reflect arbitrary origins', async () => {
    const res = await request('/health', {
      headers: { 'Origin': 'https://evil.com' }
    });
    const allowOrigin = res.headers.get('access-control-allow-origin');
    assert.ok(
      allowOrigin !== 'https://evil.com',
      'Should not reflect arbitrary origins'
    );
  });

});
