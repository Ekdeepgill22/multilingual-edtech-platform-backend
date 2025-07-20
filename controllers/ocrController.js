const ocrService = require('../services/ocrService');
const { validationResult } = require('express-validator');

/**
 * Extract text from uploaded handwritten notes
 * Supports English, Hindi, and Punjabi
 */

const mapLangCodeToTesseract = (langCode) => {
  const langMap = { en: 'eng', hi: 'hin', pa: 'pan' };
  return langMap[langCode] || 'eng';
};
const extractText = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file uploaded'
      });
    }

    const { language = 'en' } = req.body;
    const imageBuffer = req.file.buffer;
    const mimeType = req.file.mimetype;

    // Validate supported languages
    const supportedLanguages = ['en', 'hi', 'pa'];
    if (!supportedLanguages.includes(language)) {
      return res.status(400).json({
        success: false,
        message: 'Unsupported language. Supported languages: English (en), Hindi (hi), Punjabi (pa)'
      });
    }

    // Validate file type
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(mimeType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file type. Supported formats: JPEG, JPG, PNG, WebP'
      });
    }

    // Extract text using OCR service
     const result = await ocrService.extractTextFromImage(imageBuffer, {
      languages: mapLangCodeToTesseract(language)
    });

    res.status(200).json({
      success: true,
      message: 'Text extracted successfully',
      data: {
        extractedText: result.text,
        confidence: result.confidence,
        language: language,
        detectedLanguage: result.language || 'unknown',
        wordCount: result.words?.length || 0,
        processingTime: result.processingTime || null
      }
    });

  } catch (error) {
    console.error('OCR extraction error:', error);
    
    if (error.message.includes('quota exceeded')) {
      return res.status(429).json({
        success: false,
        message: 'OCR service quota exceeded. Please try again later.'
      });
    }

    if (error.message.includes('invalid image')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or corrupted image file'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error during text extraction',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};


/**
 * Get OCR processing history for a user
 */
const getOcrHistory = async (req, res) => {
  try {
    const { userId } = req.user; // Assuming user is attached via auth middleware
    const { page = 1, limit = 10, language } = req.query;

    const history = await ocrService.getUserOcrHistory(userId, {
      page: parseInt(page),
      limit: parseInt(limit),
      language
    });

    res.status(200).json({
      success: true,
      message: 'OCR history retrieved successfully',
      data: history
    });

  } catch (error) {
    console.error('Get OCR history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve OCR history',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Delete OCR record
 */
const deleteOcrRecord = async (req, res) => {
  try {
    const { recordId } = req.params;
    const { userId } = req.user;

    const deleted = await ocrService.deleteOcrRecord(recordId, userId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'OCR record not found or access denied'
      });
    }

    res.status(200).json({
      success: true,
      message: 'OCR record deleted successfully'
    });

  } catch (error) {
    console.error('Delete OCR record error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete OCR record',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get supported languages and their capabilities
 */
const getSupportedLanguages = async (req, res) => {
  try {
    const languages = await ocrService.getSupportedLanguages();

    res.status(200).json({
      success: true,
      message: 'Supported languages retrieved successfully',
      data: languages
    });

  } catch (error) {
    console.error('Get supported languages error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve supported languages',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const extractTextWithPreprocessing = async (req, res) => {
  try {
    const image = req.file.buffer;

    const preprocessOptions = {
      brightness: { alpha: 0.1 },
      contrast: { alpha: 0.1 },
      rotate: { angle: 0 } // Optional: Set angle if needed
    };

    const result = await ocrService.extractTextWithPreprocessing(image, preprocessOptions);

    res.status(200).json({
      success: true,
      message: 'Text extracted with preprocessing successfully',
      data: {
        extractedText: result.text,
        confidence: result.confidence,
        preprocessingApplied: result.preprocessingApplied
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'OCR with preprocessing failed',
      error: error.message
    });
  }
};

module.exports = {
  extractText,
  getOcrHistory,
  deleteOcrRecord,
  getSupportedLanguages,
  extractTextWithPreprocessing
};