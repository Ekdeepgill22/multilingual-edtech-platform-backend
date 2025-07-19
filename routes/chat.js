const express = require('express');
const chatController = require('../controllers/chatController');

const router = express.Router();

// Validation middleware for chat requests
const validateChatRequest = (req, res, next) => {
  const { message, language, context } = req.body;
  
  if (!message || message.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Message is required for chat interaction.'
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
  
  // Validate context if provided
  if (context && typeof context !== 'object') {
    return res.status(400).json({
      success: false,
      message: 'Context must be a valid JSON object.'
    });
  }
  
  next();
};

// Validation middleware for session-based chat
const validateSessionRequest = (req, res, next) => {
  const { sessionId } = req.params;
  
  if (!sessionId || sessionId.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Session ID is required.'
    });
  }
  
  next();
};

// POST /api/chat - Send a message to AI tutor
router.post('/', validateChatRequest, chatController.sendMessage);

// POST /api/chat/session/:sessionId - Continue conversation in a session
router.post('/session/:sessionId', validateSessionRequest, validateChatRequest, chatController.continueSession);

// GET /api/chat/history/:sessionId - Get chat history for a session
router.get('/history/:sessionId', validateSessionRequest, chatController.getChatHistory);

// POST /api/chat/session - Create a new chat session
router.post('/session', chatController.createSession);

// DELETE /api/chat/session/:sessionId - Delete a chat session
router.delete('/session/:sessionId', validateSessionRequest, chatController.deleteSession);

// GET /api/chat/sessions - Get all chat sessions for a user (if authentication is implemented)
router.get('/sessions', chatController.getUserSessions);

module.exports = router;