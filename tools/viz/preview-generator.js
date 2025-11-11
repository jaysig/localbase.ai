/**
 * Visualization Preview Generator
 * Generates 200x150px canvas previews of visualizations
 */

export class PreviewGenerator {
  constructor() {
    this.previewSize = { width: 200, height: 150 };
  }

  /**
   * Generate preview for a visualization
   */
  async generatePreview(vizUrl, type = 'dashboard') {
    try {
      console.log('🖼️ Generating preview for:', vizUrl);

      // Create hidden iframe to load the visualization
      const iframe = document.createElement('iframe');
      iframe.style.position = 'absolute';
      iframe.style.left = '-9999px';
      iframe.style.width = '800px';
      iframe.style.height = '600px';
      iframe.style.border = 'none';
      iframe.src = vizUrl;

      document.body.appendChild(iframe);

      // Wait for iframe to load
      await new Promise((resolve, reject) => {
        iframe.onload = resolve;
        iframe.onerror = reject;
        setTimeout(reject, 5000); // 5s timeout
      });

      // Give charts time to render
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Generate preview based on type
      let previewDataUrl;

      if (type === 'table') {
        previewDataUrl = await this.generateTablePreview(iframe);
      } else {
        previewDataUrl = await this.generateChartPreview(iframe);
      }

      // Clean up
      document.body.removeChild(iframe);

      return previewDataUrl;

    } catch (error) {
      console.error('❌ Preview generation failed:', error);
      return this.generateFallbackPreview(type);
    }
  }

  /**
   * Generate preview for chart/dashboard visualizations
   */
  async generateChartPreview(iframe) {
    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      const canvas = document.createElement('canvas');
      canvas.width = this.previewSize.width;
      canvas.height = this.previewSize.height;
      const ctx = canvas.getContext('2d');

      // Try to capture ApexCharts canvas if available
      const apexCanvas = iframeDoc.querySelector('canvas');
      if (apexCanvas) {
        ctx.drawImage(apexCanvas, 0, 0, this.previewSize.width, this.previewSize.height);
        return canvas.toDataURL('image/png');
      }

      // Fallback: render basic chart representation
      return this.generateChartMockup(ctx, 'chart');

    } catch (error) {
      console.error('❌ Chart preview failed:', error);
      const canvas = document.createElement('canvas');
      canvas.width = this.previewSize.width;
      canvas.height = this.previewSize.height;
      return this.generateChartMockup(canvas.getContext('2d'), 'chart');
    }
  }

  /**
   * Generate preview for table visualizations
   */
  async generateTablePreview(iframe) {
    const canvas = document.createElement('canvas');
    canvas.width = this.previewSize.width;
    canvas.height = this.previewSize.height;
    const ctx = canvas.getContext('2d');

    // Draw table mockup
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, this.previewSize.width, this.previewSize.height);

    // Table header
    ctx.fillStyle = '#667eea';
    ctx.fillRect(10, 10, this.previewSize.width - 20, 20);

    // Table rows
    ctx.fillStyle = '#2a2a2a';
    for (let i = 0; i < 6; i++) {
      const y = 35 + (i * 18);
      ctx.fillRect(10, y, this.previewSize.width - 20, 15);

      // Alternating row colors
      if (i % 2 === 0) {
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(10, y, this.previewSize.width - 20, 15);
        ctx.fillStyle = '#2a2a2a';
      }
    }

    return canvas.toDataURL('image/png');
  }

  /**
   * Generate chart mockup
   */
  generateChartMockup(ctx, type) {
    // Clear canvas
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, this.previewSize.width, this.previewSize.height);

    // Draw chart elements
    ctx.fillStyle = '#667eea';

    if (type === 'dashboard') {
      // Multiple chart areas
      ctx.fillRect(10, 10, 80, 60);
      ctx.fillRect(110, 10, 80, 60);
      ctx.fillRect(10, 80, 80, 60);
      ctx.fillRect(110, 80, 80, 60);
    } else {
      // Single chart area with bars
      const barWidth = 20;
      const heights = [40, 60, 35, 55, 45];
      for (let i = 0; i < heights.length; i++) {
        const x = 20 + (i * 30);
        const height = heights[i];
        const y = 120 - height;
        ctx.fillRect(x, y, barWidth, height);
      }
    }

    return ctx.canvas.toDataURL('image/png');
  }

  /**
   * Generate fallback preview when capture fails
   */
  generateFallbackPreview(type) {
    const canvas = document.createElement('canvas');
    canvas.width = this.previewSize.width;
    canvas.height = this.previewSize.height;
    const ctx = canvas.getContext('2d');

    return this.generateChartMockup(ctx, type);
  }
}

// Auto-generate previews when module loads (browser environment)
if (typeof window !== 'undefined') {
  window.PreviewGenerator = PreviewGenerator;
}