/**
 * Conversation Store - SQLite storage for chat conversations
 *
 * Security Note: This is designed for local/trusted network use only.
 * No authentication is implemented - all conversations are accessible
 * to anyone with network access to the server.
 */

import Database from 'better-sqlite3';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

// Security constants - input limits
export const LIMITS = {
  MAX_MESSAGE_LENGTH: 50000,    // 50KB max message
  MAX_TITLE_LENGTH: 200,        // 200 char max title
  MAX_PREVIEW_LENGTH: 100,      // 100 char preview
  MAX_SEARCH_QUERY_LENGTH: 500, // 500 char search query
  MAX_LIST_LIMIT: 100,          // Max conversations per page
  DEFAULT_LIST_LIMIT: 50,       // Default conversations per page
  MAX_SEARCH_LIMIT: 50,         // Max search results
  DEFAULT_SEARCH_LIMIT: 20,     // Default search results
};

let db = null;

/**
 * Initialize the database and create tables if needed
 */
export function initConversationStore(workspace) {
  const dataDir = join(workspace, 'data');
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = join(dataDir, 'conversations.db');
  db = new Database(dbPath);

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT,
      preview TEXT,
      model TEXT,
      provider TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      model TEXT,
      provider TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC);
  `);

  console.log('📚 Conversation store initialized:', dbPath);
  return db;
}

/**
 * Sanitize an integer parameter with bounds
 */
function sanitizeInt(value, defaultVal, maxVal) {
  const parsed = parseInt(value, 10);
  if (isNaN(parsed) || parsed < 0) return defaultVal;
  return Math.min(parsed, maxVal);
}

/**
 * Truncate string to max length
 */
function truncate(str, maxLen) {
  if (!str || typeof str !== 'string') return '';
  return str.slice(0, maxLen);
}

/**
 * Generate a unique conversation ID
 */
function generateId() {
  return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate a title from the first user message
 */
function generateTitle(content) {
  // Take first 50 chars, cut at word boundary
  let title = content.slice(0, 60);
  if (content.length > 60) {
    const lastSpace = title.lastIndexOf(' ');
    if (lastSpace > 30) title = title.slice(0, lastSpace);
    title += '...';
  }
  return title;
}

/**
 * Create a new conversation
 */
export function createConversation(firstMessage, model, provider) {
  if (!db) throw new Error('Conversation store not initialized');

  // Validate and sanitize input
  const content = truncate(firstMessage.content, LIMITS.MAX_MESSAGE_LENGTH);
  if (!content) throw new Error('Message content is required');

  const id = generateId();
  const title = generateTitle(content);
  const preview = truncate(content, LIMITS.MAX_PREVIEW_LENGTH);

  db.prepare(`
    INSERT INTO conversations (id, title, preview, model, provider)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, title, preview, model, provider);

  // Add the first message
  db.prepare(`
    INSERT INTO messages (conversation_id, role, content, model, provider)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, firstMessage.role, content, model, provider);

  return { id, title, preview, model, provider };
}

/**
 * Add a message to an existing conversation
 */
export function addMessage(conversationId, message, model, provider) {
  if (!db) throw new Error('Conversation store not initialized');

  // Validate conversation exists
  const exists = db.prepare('SELECT id FROM conversations WHERE id = ?').get(conversationId);
  if (!exists) throw new Error('Conversation not found');

  // Validate and sanitize input
  const content = truncate(message.content, LIMITS.MAX_MESSAGE_LENGTH);
  if (!content) throw new Error('Message content is required');

  db.prepare(`
    INSERT INTO messages (conversation_id, role, content, model, provider)
    VALUES (?, ?, ?, ?, ?)
  `).run(conversationId, message.role, content, model, provider);

  // Update conversation timestamp and preview if user message
  if (message.role === 'user') {
    const preview = truncate(content, LIMITS.MAX_PREVIEW_LENGTH);
    db.prepare(`
      UPDATE conversations
      SET updated_at = datetime('now'), model = ?, provider = ?, preview = ?
      WHERE id = ?
    `).run(model, provider, preview, conversationId);
  } else {
    db.prepare(`
      UPDATE conversations
      SET updated_at = datetime('now'), model = ?, provider = ?
      WHERE id = ?
    `).run(model, provider, conversationId);
  }

  return true;
}

/**
 * Get a conversation with all messages
 */
export function getConversation(conversationId) {
  if (!db) throw new Error('Conversation store not initialized');

  const conversation = db.prepare(`
    SELECT * FROM conversations WHERE id = ?
  `).get(conversationId);

  if (!conversation) return null;

  const messages = db.prepare(`
    SELECT role, content, model, provider, created_at
    FROM messages
    WHERE conversation_id = ?
    ORDER BY created_at ASC
  `).all(conversationId);

  return { ...conversation, messages };
}

/**
 * List all conversations (most recent first)
 */
export function listConversations(limit = LIMITS.DEFAULT_LIST_LIMIT, offset = 0) {
  if (!db) throw new Error('Conversation store not initialized');

  // Sanitize pagination parameters
  const safeLimit = sanitizeInt(limit, LIMITS.DEFAULT_LIST_LIMIT, LIMITS.MAX_LIST_LIMIT);
  const safeOffset = sanitizeInt(offset, 0, Number.MAX_SAFE_INTEGER);

  const conversations = db.prepare(`
    SELECT id, title, preview, model, provider, created_at, updated_at
    FROM conversations
    ORDER BY updated_at DESC
    LIMIT ? OFFSET ?
  `).all(safeLimit, safeOffset);

  const total = db.prepare(`SELECT COUNT(*) as count FROM conversations`).get().count;

  return { conversations, total };
}

/**
 * Search conversations by title or content
 */
export function searchConversations(query, limit = LIMITS.DEFAULT_SEARCH_LIMIT) {
  if (!db) throw new Error('Conversation store not initialized');

  // Sanitize search query - truncate and escape LIKE wildcards
  const safeQuery = truncate(query, LIMITS.MAX_SEARCH_QUERY_LENGTH)
    .replace(/[%_]/g, '\\$&'); // Escape LIKE wildcards
  const searchTerm = `%${safeQuery}%`;

  // Sanitize limit
  const safeLimit = sanitizeInt(limit, LIMITS.DEFAULT_SEARCH_LIMIT, LIMITS.MAX_SEARCH_LIMIT);

  // Search in titles and message content
  const conversations = db.prepare(`
    SELECT DISTINCT c.id, c.title, c.preview, c.model, c.provider, c.created_at, c.updated_at
    FROM conversations c
    LEFT JOIN messages m ON c.id = m.conversation_id
    WHERE c.title LIKE ? ESCAPE '\\' OR m.content LIKE ? ESCAPE '\\'
    ORDER BY c.updated_at DESC
    LIMIT ?
  `).all(searchTerm, searchTerm, safeLimit);

  return conversations;
}

/**
 * Update conversation title
 */
export function updateConversationTitle(conversationId, title) {
  if (!db) throw new Error('Conversation store not initialized');

  // Validate conversation exists
  const exists = db.prepare('SELECT id FROM conversations WHERE id = ?').get(conversationId);
  if (!exists) throw new Error('Conversation not found');

  // Sanitize title
  const safeTitle = truncate(title, LIMITS.MAX_TITLE_LENGTH);
  if (!safeTitle) throw new Error('Title is required');

  db.prepare(`
    UPDATE conversations SET title = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(safeTitle, conversationId);

  return true;
}

/**
 * Delete a conversation and its messages
 */
export function deleteConversation(conversationId) {
  if (!db) throw new Error('Conversation store not initialized');

  // Validate conversation exists
  const exists = db.prepare('SELECT id FROM conversations WHERE id = ?').get(conversationId);
  if (!exists) throw new Error('Conversation not found');

  db.prepare(`DELETE FROM messages WHERE conversation_id = ?`).run(conversationId);
  db.prepare(`DELETE FROM conversations WHERE id = ?`).run(conversationId);

  return true;
}

/**
 * Get the database instance (for direct queries if needed)
 */
export function getDb() {
  return db;
}
