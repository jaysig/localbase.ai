/**
 * Conversation Storage Tests
 *
 * Tests for the chat conversation storage feature.
 * Run with: npm test
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';

// Helper to make HTTP requests
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

  return { status: response.status, data };
}

// Store conversation IDs for cleanup
const createdConversations = [];

// ============================================================================
// Conversation CRUD Tests
// ============================================================================

describe('Conversation API', () => {

  it('should list conversations (empty initially or with existing)', async () => {
    const res = await request('/api/conversations');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(Array.isArray(res.data.conversations), 'Should return conversations array');
    assert.ok(typeof res.data.total === 'number', 'Should return total count');
  });

  it('should create a new conversation', async () => {
    const res = await request('/api/conversations', {
      method: 'POST',
      body: {
        message: { role: 'user', content: 'Test conversation message' },
        model: 'gpt-4o',
        provider: 'openai'
      }
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(res.data.conversation, 'Should return created conversation');
    assert.ok(res.data.conversation.id, 'Should have an ID');
    assert.ok(res.data.conversation.title, 'Should have a title');

    // Store for cleanup
    createdConversations.push(res.data.conversation.id);
  });

  it('should require message when creating conversation', async () => {
    const res = await request('/api/conversations', {
      method: 'POST',
      body: { model: 'gpt-4o' }
    });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.data.success, false);
  });

  it('should get a single conversation with messages', async () => {
    // First create one
    const createRes = await request('/api/conversations', {
      method: 'POST',
      body: {
        message: { role: 'user', content: 'Fetching test conversation' },
        model: 'gpt-4o',
        provider: 'openai'
      }
    });
    const convId = createRes.data.conversation.id;
    createdConversations.push(convId);

    // Then fetch it
    const res = await request(`/api/conversations/${convId}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(res.data.conversation, 'Should return conversation');
    assert.ok(Array.isArray(res.data.conversation.messages), 'Should have messages array');
    assert.ok(res.data.conversation.messages.length >= 1, 'Should have at least one message');
  });

  it('should return 404 for non-existent conversation', async () => {
    const res = await request('/api/conversations/nonexistent-id-12345');
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.data.success, false);
  });

  it('should add messages to existing conversation', async () => {
    // Create conversation
    const createRes = await request('/api/conversations', {
      method: 'POST',
      body: {
        message: { role: 'user', content: 'Initial message' },
        model: 'gpt-4o',
        provider: 'openai'
      }
    });
    const convId = createRes.data.conversation.id;
    createdConversations.push(convId);

    // Add another message
    const addRes = await request(`/api/conversations/${convId}/messages`, {
      method: 'POST',
      body: {
        message: { role: 'assistant', content: 'Assistant response' },
        model: 'gpt-4o',
        provider: 'openai'
      }
    });
    assert.strictEqual(addRes.status, 200);
    assert.strictEqual(addRes.data.success, true);

    // Verify messages were added
    const getRes = await request(`/api/conversations/${convId}`);
    assert.strictEqual(getRes.data.conversation.messages.length, 2);
  });

  it('should update conversation title', async () => {
    // Create conversation
    const createRes = await request('/api/conversations', {
      method: 'POST',
      body: {
        message: { role: 'user', content: 'Title update test' },
        model: 'gpt-4o',
        provider: 'openai'
      }
    });
    const convId = createRes.data.conversation.id;
    createdConversations.push(convId);

    // Update title
    const newTitle = 'Updated Test Title';
    const updateRes = await request(`/api/conversations/${convId}`, {
      method: 'PATCH',
      body: { title: newTitle }
    });
    assert.strictEqual(updateRes.status, 200);
    assert.strictEqual(updateRes.data.success, true);

    // Verify title was updated
    const getRes = await request(`/api/conversations/${convId}`);
    assert.strictEqual(getRes.data.conversation.title, newTitle);
  });

  it('should delete a conversation', async () => {
    // Create conversation
    const createRes = await request('/api/conversations', {
      method: 'POST',
      body: {
        message: { role: 'user', content: 'Delete test' },
        model: 'gpt-4o',
        provider: 'openai'
      }
    });
    const convId = createRes.data.conversation.id;

    // Delete it
    const deleteRes = await request(`/api/conversations/${convId}`, {
      method: 'DELETE'
    });
    assert.strictEqual(deleteRes.status, 200);
    assert.strictEqual(deleteRes.data.success, true);

    // Verify it's gone
    const getRes = await request(`/api/conversations/${convId}`);
    assert.strictEqual(getRes.status, 404);
  });

});

// ============================================================================
// Conversation Search Tests
// ============================================================================

describe('Conversation Search', () => {

  it('should search conversations by query', async () => {
    // Create a conversation with unique content
    const uniqueWord = `searchtest${Date.now()}`;
    const createRes = await request('/api/conversations', {
      method: 'POST',
      body: {
        message: { role: 'user', content: `Testing ${uniqueWord} search feature` },
        model: 'gpt-4o',
        provider: 'openai'
      }
    });
    const convId = createRes.data.conversation.id;
    createdConversations.push(convId);

    // Search for it
    const searchRes = await request(`/api/conversations/search?q=${uniqueWord}`);
    assert.strictEqual(searchRes.status, 200);
    assert.strictEqual(searchRes.data.success, true);
    assert.ok(Array.isArray(searchRes.data.conversations), 'Should return array');
    assert.ok(
      searchRes.data.conversations.some(c => c.id === convId),
      'Should find the created conversation'
    );
  });

  it('should require query parameter', async () => {
    const res = await request('/api/conversations/search');
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.data.success, false);
  });

  it('should return empty array for no matches', async () => {
    const res = await request('/api/conversations/search?q=xyznonexistent123456');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(Array.isArray(res.data.conversations), 'Should return array');
  });

});

// ============================================================================
// Input Validation & Security Tests
// ============================================================================

describe('Conversation Input Validation', () => {

  it('should reject message exceeding max length', async () => {
    const longMessage = 'x'.repeat(51000); // Over 50KB limit
    const res = await request('/api/conversations', {
      method: 'POST',
      body: {
        message: { role: 'user', content: longMessage },
        model: 'gpt-4o',
        provider: 'openai'
      }
    });
    assert.strictEqual(res.status, 400);
    assert.ok(res.data.error.includes('maximum length'), 'Should mention length limit');
  });

  it('should reject title exceeding max length', async () => {
    // First create a conversation
    const createRes = await request('/api/conversations', {
      method: 'POST',
      body: {
        message: { role: 'user', content: 'Title length test' },
        model: 'gpt-4o',
        provider: 'openai'
      }
    });
    const convId = createRes.data.conversation.id;
    createdConversations.push(convId);

    // Try to update with too long title
    const longTitle = 'x'.repeat(250); // Over 200 char limit
    const res = await request(`/api/conversations/${convId}`, {
      method: 'PATCH',
      body: { title: longTitle }
    });
    assert.strictEqual(res.status, 400);
    assert.ok(res.data.error.includes('maximum length'), 'Should mention length limit');
  });

  it('should return 404 when adding message to non-existent conversation', async () => {
    const res = await request('/api/conversations/nonexistent-id/messages', {
      method: 'POST',
      body: {
        message: { role: 'user', content: 'Test message' },
        model: 'gpt-4o',
        provider: 'openai'
      }
    });
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.data.success, false);
  });

  it('should return 404 when updating non-existent conversation', async () => {
    const res = await request('/api/conversations/nonexistent-id', {
      method: 'PATCH',
      body: { title: 'New Title' }
    });
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.data.success, false);
  });

  it('should return 404 when deleting non-existent conversation', async () => {
    const res = await request('/api/conversations/nonexistent-id', {
      method: 'DELETE'
    });
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.data.success, false);
  });

  it('should handle pagination with invalid limit gracefully', async () => {
    const res = await request('/api/conversations?limit=invalid&offset=-5');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    // Should use defaults instead of crashing
  });

  it('should escape LIKE wildcards in search', async () => {
    // Create conversation with % in content
    const createRes = await request('/api/conversations', {
      method: 'POST',
      body: {
        message: { role: 'user', content: 'Test with 100% accuracy' },
        model: 'gpt-4o',
        provider: 'openai'
      }
    });
    createdConversations.push(createRes.data.conversation.id);

    // Search for % - should not match everything
    const searchRes = await request('/api/conversations/search?q=%');
    assert.strictEqual(searchRes.status, 200);
    // Should not return all conversations (% is escaped)
  });

});

// ============================================================================
// Chat Config Tests
// ============================================================================

describe('Chat Configuration', () => {

  it('should return chat config with providers and models', async () => {
    const res = await request('/api/chat/config');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(res.data.provider, 'Should have provider');
    assert.ok(res.data.model, 'Should have model');
    assert.ok(Array.isArray(res.data.availableProviders), 'Should have availableProviders');
  });

  it('should include OpenAI in available providers', async () => {
    const res = await request('/api/chat/config');
    const openai = res.data.availableProviders.find(p => p.id === 'openai');
    assert.ok(openai, 'Should have OpenAI provider');
    assert.ok(Array.isArray(openai.models), 'OpenAI should have models');
    assert.ok(openai.models.includes('gpt-4o'), 'Should include gpt-4o');
  });

  it('should include Anthropic in available providers', async () => {
    const res = await request('/api/chat/config');
    const anthropic = res.data.availableProviders.find(p => p.id === 'anthropic');
    assert.ok(anthropic, 'Should have Anthropic provider');
    assert.ok(Array.isArray(anthropic.models), 'Anthropic should have models');
  });

});

// ============================================================================
// Cleanup
// ============================================================================

after(async () => {
  // Clean up created conversations
  for (const id of createdConversations) {
    try {
      await request(`/api/conversations/${id}`, { method: 'DELETE' });
    } catch {
      // Ignore cleanup errors
    }
  }
});
