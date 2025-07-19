const express = require('express');
const grammarController = require('../controllers/grammarController');

const router = express.Router();

// Validation middleware for grammar check requests
const validateGrammarRequest = (req, res, next) => {
  const { text, language } = req.body;
  
  if (!text || text.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Text is required for grammar checking.'
    });
  }
  
  const supportedLanguages = ['english', 'hindi', 'punjabi'];
  if (language && !supportedLanguages.includes(language.toLowerCase())) {
    return res.status(400).json({
      success: false,
      message: 'Supported languages are: English, Hindi, Punjabi.'
    });
  }
  
  // Set default language to English if not provided
  if (!language) {
    req.body.language = 'english';
  }
  
  next();
};

// POST /api/grammar - Check grammar and provide corrections
router.post('/', validateGrammarRequest, grammarController.checkGrammar);

module.exports = router;