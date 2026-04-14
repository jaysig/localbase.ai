import { describe, it } from 'node:test';
import assert from 'node:assert';
import { resolveVisualizationPath } from '../tools/server/chat-handler.js';

describe('Chat Handler Visualization Security', () => {
  it('should reject path traversal filenames', () => {
    assert.throws(
      () => resolveVisualizationPath('/tmp/workspace', '../../outside.html'),
      /must not include path separators/
    );
  });

  it('should reject non-html visualization filenames', () => {
    assert.throws(
      () => resolveVisualizationPath('/tmp/workspace', 'report.js'),
      /\.html/
    );
  });

  it('should resolve safe visualization filenames inside viz dir', () => {
    const result = resolveVisualizationPath('/tmp/workspace', 'revenue-chart.html');
    assert.strictEqual(result.safeFilename, 'revenue-chart.html');
    assert.strictEqual(result.vizPath, '/tmp/workspace/viz/revenue-chart.html');
  });
});
