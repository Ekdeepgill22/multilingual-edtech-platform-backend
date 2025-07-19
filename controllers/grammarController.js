const grammarService = require('../services/grammarService');
const { validationResult } = require('express-validator');

/**
 * Check grammar using Gemini API
 * Supports English, Hindi, and Punjabi text
 */
const checkGrammar = async (req, res) => {
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

    const { text, language = 'en', checkType = 'comprehensive' } = req.body;

    // Validate input
    if (!text || text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Text is required for grammar checking'
      });
    }

    if (text.length > 5000) {
      return res.status(400).json({
        success: false,
        message: 'Text exceeds maximum length of 5000 characters'
      });
    }

    // Validate supported languages
    const supportedLanguages = ['en', 'hi', 'pa'];
    if (!supportedLanguages.includes(language)) {
      return res.status(400).json({
        success: false,
        message: 'Unsupported language. Supported languages: English (en), Hindi (hi), Punjabi (pa)'
      });
    }

    // Validate check types
    const supportedCheckTypes = ['comprehensive', 'spelling', 'grammar', 'punctuation', 'style'];
    if (!supportedCheckTypes.includes(checkType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid check type. Supported types: comprehensive, spelling, grammar, punctuation, style'
      });
    }

    // Perform grammar check using Gemini API
    const result = await grammarService.checkGrammar(text, language, checkType);

    res.status(200).json({
      success: true,
      message: 'Grammar check completed successfully',
      data: {
        originalText: text,
        correctedText: result.correctedText,
        errors: result.errors,
        suggestions: result.suggestions,
        overallScore: result.overallScore,
        language: language,
        checkType: checkType,
        statistics: {
          totalErrors: result.errors.length,
          errorsByType: result.errorsByType,
          readabilityScore: result.readabilityScore,
          wordCount: result.wordCount
        },
        processingTime: result.processingTime
      }
    });

  } catch (error) {
    console.error('Grammar check error:', error);
    
    if (error.message.includes('API quota exceeded')) {
      return res.status(429).json({
        success: false,
        message: 'Grammar check quota exceeded. Please try again later.'
      });
    }

    if (error.message.includes('language not supported')) {
      return res.status(400).json({
        success: false,
        message: 'Language not supported by grammar service'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error during grammar check',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get detailed grammar suggestions and explanations
 */
const getGrammarSuggestions = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { text, language = 'en', errorType } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Text is required for getting suggestions'
      });
    }

    const suggestions = await grammarService.getDetailedSuggestions(text, language, errorType);

    res.status(200).json({
      success: true,
      message: 'Grammar suggestions retrieved successfully',
      data: {
        suggestions: suggestions.detailedSuggestions,
        explanations: suggestions.explanations,
        examples: suggestions.examples,
        difficulty: suggestions.difficulty,
        learningTips: suggestions.learningTips
      }
    });

  } catch (error) {
    console.error('Get grammar suggestions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve grammar suggestions',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Batch grammar check for multiple texts
 */
const batchGrammarCheck = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { texts, language = 'en', checkType = 'comprehensive' } = req.body;

    if (!Array.isArray(texts) || texts.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Array of texts is required for batch processing'
      });
    }

    if (texts.length > 20) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 20 texts allowed for batch processing'
      });
    }

    // Validate each text
    for (let i = 0; i < texts.length; i++) {
      if (!texts[i] || texts[i].trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: `Text at index ${i} is empty or invalid`
        });
      }
      if (texts[i].length > 2000) {
        return res.status(400).json({
          success: false,
          message: `Text at index ${i} exceeds maximum length of 2000 characters for batch processing`
        });
      }
    }

    const results = await grammarService.batchGrammarCheck(texts, language, checkType);

    res.status(200).json({
      success: true,
      message: 'Batch grammar check completed successfully',
      data: {
        results: results.results,
        summary: {
          totalTexts: texts.length,
          totalErrors: results.summary.totalErrors,
          averageScore: results.summary.averageScore,
          processingTime: results.summary.processingTime
        }
      }
    });

  } catch (error) {
    console.error('Batch grammar check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete batch grammar check',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get grammar check history for a user
 */
const getGrammarHistory = async (req, res) => {
  try {
    const { userId } = req.user; // Assuming user is attached via auth middleware
    const { page = 1, limit = 10, language, checkType } = req.query;

    const history = await grammarService.getUserGrammarHistory(userId, {
      page: parseInt(page),
      limit: parseInt(limit),
      language,
      checkType
    });

    res.status(200).json({
      success: true,
      message: 'Grammar check history retrieved successfully',
      data: history
    });

  } catch (error) {
    console.error('Get grammar history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve grammar history',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get grammar statistics for a user
 */
const getGrammarStats = async (req, res) => {
  try {
    const { userId } = req.user;
    const { timeRange = '30d', language } = req.query;

    const stats = await grammarService.getUserGrammarStats(userId, timeRange, language);

    res.status(200).json({
      success: true,
      message: 'Grammar statistics retrieved successfully',
      data: stats
    });

  } catch (error) {
    console.error('Get grammar stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve grammar statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  checkGrammar,
  getGrammarSuggestions,
  batchGrammarCheck,
  getGrammarHistory,
  getGrammarStats
};