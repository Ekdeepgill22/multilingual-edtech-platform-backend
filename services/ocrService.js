const Tesseract = require('tesseract.js');
const Jimp = require('jimp');
const fs = require('fs').promises;
const path = require('path');

class OCRService {
  constructor() {
    this.languages = 'hin+pan+eng'; // Hindi + Punjabi + English
    this.options = {
      logger: m => console.log(m) // Optional debug logger
    };
  }

  decodeBase64Image(base64String) {
    const matches = base64String.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      throw new Error('Invalid base64 image format.');
    }
    return Buffer.from(matches[2], 'base64');
  }

  async extractTextFromImage(imageInput, options = {}) {
    try {
      const { languages = this.languages, ...tesseractOptions } = options;

      const input =
        typeof imageInput === 'string' && imageInput.startsWith('data:')
          ? this.decodeBase64Image(imageInput)
          : imageInput;

      console.log('🔍 Starting OCR...');

      const result = await Tesseract.recognize(
        input,
        languages,
        { ...this.options, ...tesseractOptions }
      );

      return {
        success: true,
        text: result.data.text.trim(),
        confidence: isNaN(result.data.confidence)
          ? null
          : parseFloat(result.data.confidence.toFixed(2)),
        words: result.data.words.map(word => ({
          text: word.text,
          confidence: word.confidence,
          bbox: word.bbox
        })),
        language: this.detectPrimaryLanguage(result.data.text)
      };

    } catch (error) {
      console.error('❌ OCR Error:', error);
      throw new Error(`OCR processing failed: ${error.message}`);
    }
  }

  async extractTextWithPreprocessing(imageInput, preprocessOptions = {}) {
    try {
      const inputBuffer =
        typeof imageInput === 'string' && imageInput.startsWith('data:')
          ? this.decodeBase64Image(imageInput)
          : imageInput;

      const image = await Jimp.read(inputBuffer);

      if (preprocessOptions.rotate)
        image.rotate(preprocessOptions.rotate.angle || 0);
      if (preprocessOptions.brightness)
        image.brightness(preprocessOptions.brightness.alpha || 0.1);
      if (preprocessOptions.contrast)
        image.contrast(preprocessOptions.contrast.alpha || 0.1);

      const processedBuffer = await image.getBufferAsync(Jimp.MIME_PNG);

      const result = await Tesseract.recognize(
        processedBuffer,
        this.languages,
        this.options
      );

      return {
        success: true,
        text: result.data.text.trim(),
        confidence: isNaN(result.data.confidence)
          ? null
          : parseFloat(result.data.confidence.toFixed(2)),
        preprocessingApplied: preprocessOptions
      };
    } catch (error) {
      console.error('❌ Preprocessing OCR Error:', error);
      throw new Error(`OCR with preprocessing failed: ${error.message}`);
    }
  }

  async extractTextFromMultipleImages(imageInputs, options = {}) {
    try {
      const results = [];
      for (let i = 0; i < imageInputs.length; i++) {
        console.log(`📄 Processing image ${i + 1}/${imageInputs.length}`);
        const result = await this.extractTextFromImage(imageInputs[i], options);
        results.push({ index: i, ...result });
      }

      return {
        success: true,
        results,
        totalProcessed: imageInputs.length
      };
    } catch (error) {
      console.error('❌ Batch OCR Error:', error);
      throw new Error(`Batch OCR processing failed: ${error.message}`);
    }
  }

  detectPrimaryLanguage(text) {
    const hindiPattern = /[\u0900-\u097F]/;
    const punjabiPattern = /[\u0A00-\u0A7F]/;

    if (hindiPattern.test(text)) return 'hindi';
    if (punjabiPattern.test(text)) return 'punjabi';
    return 'english';
  }

  async validateImage(filePath) {
    try {
      const stats = await fs.stat(filePath);
      const ext = path.extname(filePath).toLowerCase();

      if (stats.size > 10 * 1024 * 1024) {
        throw new Error('Image file too large. Max size is 10MB.');
      }

      const supportedFormats = ['.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.webp'];
      if (!supportedFormats.includes(ext)) {
        throw new Error(`Unsupported image format. Supported: ${supportedFormats.join(', ')}`);
      }

      return true;
    } catch (error) {
      throw new Error(`Image validation failed: ${error.message}`);
    }
  }
}

module.exports = new OCRService();
