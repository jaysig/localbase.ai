import Tesseract from 'tesseract.js';

export class OCRExtractor {
  constructor() {
    this.options = {
      logger: m => console.log(m) // Optional: log progress
    };
  }

  async extractTextFromImage(imagePath) {
    try {
      console.log(`🔍 Starting OCR extraction from: ${imagePath}`);

      const { data: { text } } = await Tesseract.recognize(imagePath, 'eng', this.options);

      console.log(`✅ OCR extraction completed for: ${imagePath}`);
      return text.trim();
    } catch (error) {
      console.error(`❌ OCR extraction failed for ${imagePath}:`, error);
      throw error;
    }
  }

  async extractDataFromPNG(imagePath) {
    const text = await this.extractTextFromImage(imagePath);

    // Parse the extracted text to find structured data
    const lines = text.split('\n').filter(line => line.trim().length > 0);

    console.log('📄 Extracted text lines:', lines);
    return {
      rawText: text,
      lines: lines
    };
  }
}