const grammarService = require('../services/grammarService');
const { validationResult } = require('express-validator');

/**
 * Check grammar using Gemini API
 * Supports English, Hindi, and Punjabi text
 */
const checkGrammar = async (req, res) => {
  try {
    // Validate input from express-validator
    const validationErrors = validationResult(req);
    if (!validationErrors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors.array()
      });
    }

    const { text, language = 'en', checkType = 'comprehensive' } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Text is required for grammar checking.'
      });
    }

    if (text.length > 5000) {
      return res.status(400).json({
        success: false,
        message: 'Text exceeds maximum length of 5000 characters.'
      });
    }

    const supportedLanguages = ['en', 'hi', 'pa'];
    if (!supportedLanguages.includes(language.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'Unsupported language. Supported languages: English (en), Hindi (hi), Punjabi (pa)'
      });
    }

    const supportedCheckTypes = ['comprehensive', 'spelling', 'grammar', 'punctuation', 'style'];
    if (!supportedCheckTypes.includes(checkType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid check type. Supported types: comprehensive, spelling, grammar, punctuation, style'
      });
    }

    // Perform grammar check
    const languageMap = {
      en: 'english',
      hi: 'hindi',
      pa: 'punjabi'
    };

    const fullLang = languageMap[language.toLowerCase()];
    if (!fullLang) {
      return res.status(400).json({
        success: false,
        message: 'Unsupported language. Supported languages: English (en), Hindi (hi), Punjabi (pa)'
      });
    }

    const result = await grammarService.correctGrammar(text, fullLang, checkType);
    // console.log('Grammar correction result:', result);

    const errors = Array.isArray(result.errors)
      ? result.errors
      : Array.isArray(result.changes)
        ? result.changes
        : [];

    const suggestions = Array.isArray(result.suggestions)
      ? result.suggestions
      : [];

    const overallScore = result.overallScore || result.confidence || 0;

    return res.status(200).json({
      success: true,
      message: 'Grammar check completed successfully.',
      data: {
        originalText: result.original || text,
        correctedText: result.corrected || result.correctedText || '',
        errors,
        suggestions,
        overallScore,
        language,
        checkType,
        statistics: {
          totalErrors: errors.length,
          readabilityScore: result.readabilityScore || 0,
          wordCount: result.wordCount || 0
        },
        processingTime: result.processingTime || 0
      }
    });
  } catch (error) {
    console.error('Grammar check error:', error);

    if (error.message?.toLowerCase().includes('unsupported language')) {
      return res.status(400).json({
        success: false,
        message: 'Language not supported by grammar service.'
      });
    }

    if (error.message?.toLowerCase().includes('quota')) {
      return res.status(429).json({
        success: false,
        message: 'Grammar check quota exceeded. Please try again later.'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Internal server error during grammar check.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};


/**
 * Get detailed grammar suggestions and explanations
 */
const getGrammarSuggestions = async (req, res) => {
  try {
    const validationErrors  = validationResult(req);
    if (!validationErrors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors.array()
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
    const validationErrors  = validationResult(req);
    if (!validationErrors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors.array()
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