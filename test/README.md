# LocalBase Tests

## Running Tests

Tests require the server to be running:

```bash
# Terminal 1: Start the server
npm start

# Terminal 2: Run tests
npm test
```

Or run with watch mode during development:

```bash
npm run test:watch
```

## Test Categories

### security.test.js
- SQL injection prevention (LIMIT clauses, table names)
- Path traversal prevention (../, absolute paths, sensitive files)
- XSS prevention (HTML escaping in error responses)
- Command injection prevention (shell metacharacters, parameter validation)
- Security headers (X-Frame-Options, X-Content-Type-Options, etc.)
- CORS restrictions (origin validation)

## Writing Tests

Uses Node.js built-in test runner (no external dependencies):

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('My Feature', () => {
  it('should do something', async () => {
    const res = await request('/api/endpoint');
    assert.strictEqual(res.status, 200);
  });
});
```

## Adding New Tests

1. Create `test/your-feature.test.js`
2. Import from `node:test` and `node:assert`
3. Tests auto-discover via `test/**/*.test.js` pattern
