/**
 * Test Setup - Provides request helper for API tests
 *
 * The server should be started externally via scripts/run-tests.sh
 * before running the tests. This module just provides helpers.
 *
 * For backwards compat, startTestServer/stopTestServer are no-ops.
 */

/**
 * No-op for backwards compatibility - server is started by run-tests.sh
 */
export async function startTestServer() {
  // Server is started by scripts/run-tests.sh
}

/**
 * No-op for backwards compatibility - server is stopped by run-tests.sh
 */
export async function stopTestServer() {
  // Server is stopped by scripts/run-tests.sh
}

/**
 * Helper to make HTTP requests
 */
export async function request(path, options = {}) {
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
