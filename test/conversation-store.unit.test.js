/**
 * Conversation Store Unit Tests
 *
 * Direct unit tests for conversation-store.js functions.
 * These can be measured by c8 for coverage.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Import the module under test
import {
  initConversationStore,
  createConversation,
  addMessage,
  getConversation,
  listConversations,
  searchConversations,
  updateConversationTitle,
  deleteConversation,
  LIMITS
} from '../tools/server/conversation-store.js';

// Create a temp directory for test database
let tempDir;

before(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'localbase-test-'));
  initConversationStore(tempDir);
});

after(() => {
  // Clean up temp directory
  try {
    rmSync(tempDir, { recursive: true });
  } catch {
    // Ignore cleanup errors
  }
});

// ============================================================================
// LIMITS constant tests
// ============================================================================

describe('LIMITS constants', () => {
  it('should have reasonable message length limit', () => {
    assert.strictEqual(LIMITS.MAX_MESSAGE_LENGTH, 50000);
  });

  it('should have reasonable title length limit', () => {
    assert.strictEqual(LIMITS.MAX_TITLE_LENGTH, 200);
  });

  it('should have reasonable search query limit', () => {
    assert.strictEqual(LIMITS.MAX_SEARCH_QUERY_LENGTH, 500);
  });

  it('should have reasonable list limits', () => {
    assert.strictEqual(LIMITS.MAX_LIST_LIMIT, 100);
    assert.strictEqual(LIMITS.DEFAULT_LIST_LIMIT, 50);
  });
});

// ============================================================================
// createConversation tests
// ============================================================================

describe('createConversation', () => {
  it('should create conversation with valid input', () => {
    const result = createConversation(
      { role: 'user', content: 'Hello world' },
      'gpt-4o',
      'openai'
    );

    assert.ok(result.id.startsWith('conv_'), 'ID should start with conv_');
    assert.strictEqual(result.title, 'Hello world');
    assert.strictEqual(result.model, 'gpt-4o');
    assert.strictEqual(result.provider, 'openai');
  });

  it('should truncate long messages', () => {
    const longContent = 'x'.repeat(60000);
    const result = createConversation(
      { role: 'user', content: longContent },
      'gpt-4o',
      'openai'
    );

    // Should not throw, message is truncated internally
    assert.ok(result.id);
  });

  it('should generate title from content', () => {
    const result = createConversation(
      { role: 'user', content: 'This is a test message for title generation' },
      'gpt-4o',
      'openai'
    );

    assert.ok(result.title.length <= 63); // 60 + "..."
    assert.ok(result.title.includes('This is a test'));
  });

  it('should throw on empty content', () => {
    assert.throws(() => {
      createConversation({ role: 'user', content: '' }, 'gpt-4o', 'openai');
    }, /content is required/);
  });
});

// ============================================================================
// getConversation tests
// ============================================================================

describe('getConversation', () => {
  it('should return null for non-existent conversation', () => {
    const result = getConversation('nonexistent-id');
    assert.strictEqual(result, null);
  });

  it('should return conversation with messages', () => {
    const created = createConversation(
      { role: 'user', content: 'Get test' },
      'gpt-4o',
      'openai'
    );

    const result = getConversation(created.id);
    assert.ok(result);
    assert.strictEqual(result.id, created.id);
    assert.ok(Array.isArray(result.messages));
    assert.strictEqual(result.messages.length, 1);
    assert.strictEqual(result.messages[0].content, 'Get test');
  });
});

// ============================================================================
// addMessage tests
// ============================================================================

describe('addMessage', () => {
  it('should add message to existing conversation', () => {
    const created = createConversation(
      { role: 'user', content: 'Initial' },
      'gpt-4o',
      'openai'
    );

    addMessage(created.id, { role: 'assistant', content: 'Response' }, 'gpt-4o', 'openai');

    const result = getConversation(created.id);
    assert.strictEqual(result.messages.length, 2);
    assert.strictEqual(result.messages[1].content, 'Response');
  });

  it('should throw for non-existent conversation', () => {
    assert.throws(() => {
      addMessage('nonexistent', { role: 'user', content: 'Test' }, 'gpt-4o', 'openai');
    }, /Conversation not found/);
  });

  it('should throw on empty content', () => {
    const created = createConversation(
      { role: 'user', content: 'Test' },
      'gpt-4o',
      'openai'
    );

    assert.throws(() => {
      addMessage(created.id, { role: 'assistant', content: '' }, 'gpt-4o', 'openai');
    }, /content is required/);
  });
});

// ============================================================================
// listConversations tests
// ============================================================================

describe('listConversations', () => {
  it('should return conversations array', () => {
    const result = listConversations();
    assert.ok(Array.isArray(result.conversations));
    assert.ok(typeof result.total === 'number');
  });

  it('should respect limit parameter', () => {
    // Create a few conversations
    for (let i = 0; i < 5; i++) {
      createConversation({ role: 'user', content: `List test ${i}` }, 'gpt-4o', 'openai');
    }

    const result = listConversations(2, 0);
    assert.ok(result.conversations.length <= 2);
  });

  it('should sanitize invalid limit', () => {
    // Should not throw with invalid inputs
    const result = listConversations('invalid', -5);
    assert.ok(Array.isArray(result.conversations));
  });

  it('should cap limit at MAX_LIST_LIMIT', () => {
    const result = listConversations(9999, 0);
    // Should not return more than MAX_LIST_LIMIT
    assert.ok(result.conversations.length <= LIMITS.MAX_LIST_LIMIT);
  });
});

// ============================================================================
// searchConversations tests
// ============================================================================

describe('searchConversations', () => {
  it('should find conversations by content', () => {
    const uniqueWord = `uniquesearch${Date.now()}`;
    createConversation({ role: 'user', content: `Testing ${uniqueWord}` }, 'gpt-4o', 'openai');

    const result = searchConversations(uniqueWord);
    assert.ok(result.some(c => c.preview.includes(uniqueWord)));
  });

  it('should return empty array for no matches', () => {
    const result = searchConversations('xyznonexistent987654321');
    assert.ok(Array.isArray(result));
    assert.strictEqual(result.length, 0);
  });

  it('should escape LIKE wildcards', () => {
    // Search for % should not match everything
    const result = searchConversations('%');
    // This should work without error and not return all results
    assert.ok(Array.isArray(result));
  });

  it('should truncate long search queries', () => {
    const longQuery = 'x'.repeat(1000);
    // Should not throw
    const result = searchConversations(longQuery);
    assert.ok(Array.isArray(result));
  });
});

// ============================================================================
// updateConversationTitle tests
// ============================================================================

describe('updateConversationTitle', () => {
  it('should update title', () => {
    const created = createConversation(
      { role: 'user', content: 'Title update test' },
      'gpt-4o',
      'openai'
    );

    updateConversationTitle(created.id, 'New Title');

    const result = getConversation(created.id);
    assert.strictEqual(result.title, 'New Title');
  });

  it('should throw for non-existent conversation', () => {
    assert.throws(() => {
      updateConversationTitle('nonexistent', 'Title');
    }, /Conversation not found/);
  });

  it('should throw on empty title', () => {
    const created = createConversation(
      { role: 'user', content: 'Test' },
      'gpt-4o',
      'openai'
    );

    assert.throws(() => {
      updateConversationTitle(created.id, '');
    }, /Title is required/);
  });

  it('should truncate long titles', () => {
    const created = createConversation(
      { role: 'user', content: 'Test' },
      'gpt-4o',
      'openai'
    );

    const longTitle = 'x'.repeat(300);
    updateConversationTitle(created.id, longTitle);

    const result = getConversation(created.id);
    assert.ok(result.title.length <= LIMITS.MAX_TITLE_LENGTH);
  });
});

// ============================================================================
// deleteConversation tests
// ============================================================================

describe('deleteConversation', () => {
  it('should delete conversation', () => {
    const created = createConversation(
      { role: 'user', content: 'Delete test' },
      'gpt-4o',
      'openai'
    );

    deleteConversation(created.id);

    const result = getConversation(created.id);
    assert.strictEqual(result, null);
  });

  it('should throw for non-existent conversation', () => {
    assert.throws(() => {
      deleteConversation('nonexistent');
    }, /Conversation not found/);
  });

  it('should delete associated messages', () => {
    const created = createConversation(
      { role: 'user', content: 'Test' },
      'gpt-4o',
      'openai'
    );
    addMessage(created.id, { role: 'assistant', content: 'Response' }, 'gpt-4o', 'openai');

    deleteConversation(created.id);

    // Messages should be gone with conversation
    const result = getConversation(created.id);
    assert.strictEqual(result, null);
  });
});
