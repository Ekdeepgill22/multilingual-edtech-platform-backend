// services/ocrService.js
const Tesseract = require('tesseract.js');

class OCRService {
  constructor() {
    // Configure Tesseract with language support for Hindi, Punjabi, and English
    this.languages = 'hin+pan+eng'; // Hindi + Punjabi + English
    this.options = {
      logger: m => console.log(m) // Optional: for debugging
    };
  }

  /**
   * Extract text from handwritten image using Tesseract OCR
   * @param {string|Buffer} imageInput - Image file path or buffer
   * @param {Object} options - Additional OCR options
   * @returns {Promise<Object>} - Extracted text and confidence data
   */
  async extractTextFromImage(imageInput, options = {}) {
    try {
      const { languages = this.languages, ...tesseractOptions } = options;

      console.log('Starting OCR processing...');
      
      const result = await Tesseract.recognize(
        imageInput,
        languages,
        {
          ...this.options,
          ...tesseractOptions
        }
      );

      return {
        success: true,
        text: result.data.text.trim(),
        confidence: result.data.confidence,
        words: result.data.words.map(word => ({
          text: word.text,
          confidence: word.confidence,
          bbox: word.bbox
        })),
        language: result.data.text ? this.detectPrimaryLanguage(result.data.text) : 'unknown'
      };

    } catch (error) {
      console.error('OCR Error:', error);
      throw new Error(`OCR processing failed: ${error.message}`);
    }
  }

  /**
   * Process multiple images for batch OCR
   * @param {Array} imageInputs - Array of image paths or buffers
   * @param {Object} options - OCR options
   * @returns {Promise<Array>} - Array of OCR results
   */
  async extractTextFromMultipleImages(imageInputs, options = {}) {
    try {
      const results = [];
      
      for (let i = 0; i < imageInputs.length; i++) {
        console.log(`Processing image ${i + 1}/${imageInputs.length}`);
        const result = await this.extractTextFromImage(imageInputs[i], options);
        results.push({
          index: i,
          ...result
        });
      }

      return {
        success: true,
        results,
        totalProcessed: imageInputs.length
      };

    } catch (error) {
      console.error('Batch OCR Error:', error);
      throw new Error(`Batch OCR processing failed: ${error.message}`);
    }
  }

  /**
   * Preprocess image for better OCR accuracy
   * @param {string|Buffer} imageInput - Image input
   * @param {Object} preprocessOptions - Preprocessing options
   * @returns {Promise<Object>} - OCR result with preprocessing
   */
  async extractTextWithPreprocessing(imageInput, preprocessOptions = {}) {
    try {
      const defaultPreprocessing = {
        rotate: { angle: 0 },
        contrast: { alpha: 1.2 },
        brightness: { alpha: 1.1 }
      };

      const preprocessing = { ...defaultPreprocessing, ...preprocessOptions };

      const result = await Tesseract.recognize(
        imageInput,
        this.languages,
        {
          ...this.options,
          preprocess: preprocessing
        }
      );

      return {
        success: true,
        text: result.data.text.trim(),
        confidence: result.data.confidence,
        preprocessingApplied: preprocessing
      };

    } catch (error) {
      console.error('OCR Preprocessing Error:', error);
      throw new Error(`OCR with preprocessing failed: ${error.message}`);
    }
  }

  /**
   * Detect primary language from extracted text
   * @param {string} text - Extracted text
   * @returns {string} - Detected language code
   */
  detectPrimaryLanguage(text) {
    // Simple language detection based on character ranges
    const hindiPattern = /[\u0900-\u097F]/;
    const punjabiPattern = /[\u0A00-\u0A7F]/;
    
    if (hindiPattern.test(text)) return 'hindi';
    if (punjabiPattern.test(text)) return 'punjabi';
    return 'english';
  }

  /**
   * Validate image format and size
   * @param {string} filePath - Image file path
   * @returns {Promise<boolean>} - Validation result
   */
  async validateImage(filePath) {
    try {
      const fs = require('fs').promises;
      const path = require('path');
      
      const stats = await fs.stat(filePath);
      const ext = path.extname(filePath).toLowerCase();
      
      // Check file size (max 10MB)
      if (stats.size > 10 * 1024 * 1024) {
        throw new Error('Image file too large. Maximum size is 10MB.');
      }
      
      // Check supported formats
      const supportedFormats = ['.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.webp'];
      if (!supportedFormats.includes(ext)) {
        throw new Error(`Unsupported image format. Supported formats: ${supportedFormats.join(', ')}`);
      }
      
      return true;
    } catch (error) {
      throw new Error(`Image validation failed: ${error.message}`);
    }
  }
}

module.exports = new OCRService();