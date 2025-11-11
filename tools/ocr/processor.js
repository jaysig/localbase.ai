#!/usr/bin/env node

import { OCRExtractor } from './index.js';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';

export class OCRProcessor {
  constructor() {
    this.extractor = new OCRExtractor();
  }

  async processImages(imagePaths, outputPath = null) {
    const results = [];

    console.log(`🔍 Starting OCR processing for ${imagePaths.length} images...\n`);

    for (const imagePath of imagePaths) {
      try {
        console.log(`\n📸 Processing: ${path.basename(imagePath)}`);
        const result = await this.extractor.extractDataFromPNG(imagePath);

        results.push({
          filename: path.basename(imagePath),
          path: imagePath,
          ...result
        });

        console.log(`\n📄 Raw text from ${path.basename(imagePath)}:`);
        console.log('='.repeat(50));
        console.log(result.rawText);
        console.log('='.repeat(50));

      } catch (error) {
        console.error(`❌ Failed to process ${imagePath}:`, error.message);
        results.push({
          filename: path.basename(imagePath),
          path: imagePath,
          error: error.message
        });
      }
    }

    // Optionally save results to file
    if (outputPath) {
      writeFileSync(outputPath, JSON.stringify(results, null, 2));
      console.log(`\n💾 Results saved to: ${outputPath}`);
    }

    return results;
  }

  async processSingleImage(imagePath) {
    const results = await this.processImages([imagePath]);
    return results[0];
  }
}

// CLI usage if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const processor = new OCRProcessor();
  const imagePaths = process.argv.slice(2);

  if (imagePaths.length === 0) {
    console.log('Usage: node processor.js <image1> [image2] [image3] ...');
    process.exit(1);
  }

  processor.processImages(imagePaths).catch(console.error);
}