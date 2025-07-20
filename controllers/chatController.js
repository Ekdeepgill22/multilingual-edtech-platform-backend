const chatService = require('../services/chatService');
const { validationResult } = require('express-validator');

/**
 * Send message to AI grammar tutor via DialogFlow
 * Handles multilingual conversations in English, Hindi, and Punjabi
 */
const sendMessage = async (req, res) => {
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

    const { 
      message, 
      sessionId, 
      language = 'en',
      context = {},
      messageType = 'text'
    } = req.body;
    const { userId } = req.user; // Assuming user is attached via auth middleware

    // Validate input
    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Message is required'
      });
    }

    if (message.length > 2000) {
      return res.status(400).json({
        success: false,
        message: 'Message exceeds maximum length of 2000 characters'
      });
    }

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID is required'
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

    // Validate message types
    const supportedMessageTypes = ['text', 'grammar_question', 'pronunciation_help', 'exercise_request'];
    if (!supportedMessageTypes.includes(messageType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid message type. Supported types: text, grammar_question, pronunciation_help, exercise_request'
      });
    }

    // Send message to DialogFlow
    const response = await chatService.sendMessageToDialogFlow({
      message,
      sessionId,
      userId,
      language,
      context,
      messageType
    });

    res.status(200).json({
      success: true,
      message: 'Message sent successfully',
      data: {
        botResponse: response.botResponse,
        intent: response.intent,
        confidence: response.confidence,
        language: language,
        sessionId: sessionId,
        followUpQuestions: response.followUpQuestions,
        suggestedActions: response.suggestedActions,
        mediaContent: response.mediaContent,
        metadata: {
          responseTime: response.responseTime,
          contextUpdated: response.contextUpdated,
          userProgress: response.userProgress
        }
      }
    });

  } catch (error) {
    console.error('Chat message error:', error);
    
    if (error.message.includes('session expired')) {
      return res.status(401).json({
        success: false,
        message: 'Chat session expired. Please start a new session.'
      });
    }

    if (error.message.includes('quota exceeded')) {
      return res.status(429).json({
        success: false,
        message: 'Chat service quota exceeded. Please try again later.'
      });
    }

    if (error.message.includes('inappropriate content')) {
      return res.status(400).json({
        success: false,
        message: 'Message contains inappropriate content and cannot be processed'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error during chat processing',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Start a new chat session
 */
const startChatSession = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { userId } = req.user;
    const { language = 'en', sessionType = 'general', userLevel = 'intermediate' } = req.body;

    // Validate supported languages
    const supportedLanguages = ['en', 'hi', 'pa'];
    if (!supportedLanguages.includes(language)) {
      return res.status(400).json({
        success: false,
        message: 'Unsupported language. Supported languages: English (en), Hindi (hi), Punjabi (pa)'
      });
    }

    // Validate session types
    const supportedSessionTypes = ['general', 'grammar_focused', 'pronunciation_focused', 'writing_help'];
    if (!supportedSessionTypes.includes(sessionType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid session type. Supported types: general, grammar_focused, pronunciation_focused, writing_help'
      });
    }

    // Start new chat session
    const session = await chatService.startNewSession({
      userId,
      language,
      sessionType,
      userLevel
    });

    res.status(201).json({
      success: true,
      message: 'Chat session started successfully',
      data: {
        sessionId: session.sessionId,
        welcomeMessage: session.welcomeMessage,
        language: language,
        sessionType: sessionType,
        userLevel: userLevel,
        suggestedQuestions: session.suggestedQuestions,
        sessionCapabilities: session.capabilities,
        expiresAt: session.expiresAt
      }
    });

  } catch (error) {
    console.error('Start chat session error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start chat session',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get chat session history
 */
const getChatHistory = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { userId } = req.user;
    const { page = 1, limit = 50 } = req.query;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID is required'
      });
    }

    const history = await chatService.getChatHistory(sessionId, userId, {
      page: parseInt(page),
      limit: parseInt(limit)
    });

    if (!history) {
      return res.status(404).json({
        success: false,
        message: 'Chat session not found or access denied'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Chat history retrieved successfully',
      data: history
    });

  } catch (error) {
    console.error('Get chat history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve chat history',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get all chat sessions for a user
 */
const getUserChatSessions = async (req, res) => {
  try {
    const { userId } = req.user;
    const { page = 1, limit = 20, sessionType, language, status = 'all' } = req.query;

    const sessions = await chatService.getUserChatSessions(userId, {
      page: parseInt(page),
      limit: parseInt(limit),
      sessionType,
      language,
      status
    });

    res.status(200).json({
      success: true,
      message: 'Chat sessions retrieved successfully',
      data: sessions
    });

  } catch (error) {
    console.error('Get user chat sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve chat sessions',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * End chat session
 */
const endChatSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { userId } = req.user;
    const { feedback, rating } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID is required'
      });
    }

    const result = await chatService.endChatSession(sessionId, userId, {
      feedback,
      rating
    });

    if (!result.found) {
      return res.status(404).json({
        success: false,
        message: 'Chat session not found or access denied'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Chat session ended successfully',
      data: {
        sessionSummary: result.summary,
        duration: result.duration,
        messageCount: result.messageCount,
        topicsDiscussed: result.topicsDiscussed,
        learningProgress: result.learningProgress
      }
    });

  } catch (error) {
    console.error('End chat session error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to end chat session',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get chat session context and state
 */
const getSessionContext = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { userId } = req.user;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID is required'
      });
    }

    const context = await chatService.getSessionContext(sessionId, userId);

    if (!context) {
      return res.status(404).json({
        success: false,
        message: 'Chat session not found or access denied'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Session context retrieved successfully',
      data: context
    });

  } catch (error) {
    console.error('Get session context error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve session context',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Update session context (for maintaining conversation state)
 */
const updateSessionContext = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { userId } = req.user;
    const { context, userPreferences, learningGoals } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID is required'
      });
    }

    const updated = await chatService.updateSessionContext(sessionId, userId, {
      context,
      userPreferences,
      learningGoals
    });

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Chat session not found or access denied'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Session context updated successfully'
    });

  } catch (error) {
    console.error('Update session context error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update session context',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get chat analytics and insights
 */
const getChatAnalytics = async (req, res) => {
  try {
    const { userId } = req.user;
    const { timeRange = '30d', language } = req.query;

    const analytics = await chatService.getUserChatAnalytics(userId, timeRange, language);

    res.status(200).json({
      success: true,
      message: 'Chat analytics retrieved successfully',
      data: analytics
    });

  } catch (error) {
    console.error('Get chat analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve chat analytics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const continueSession = async (req, res) => {
  // TODO: Implement continue session logic
  res.status(501).json({ message: 'Not Implemented' });
};

const createSession = async (req, res) => {
  // TODO: Implement create session logic
  res.status(501).json({ message: 'Not Implemented' });
};

const deleteSession = async (req, res) => {
  // TODO: Implement delete session logic
  res.status(501).json({ message: 'Not Implemented' });
};

const getUserSessions = async (req, res) => {
  // TODO: Implement get user sessions logic
  res.status(501).json({ message: 'Not Implemented' });
};

module.exports = {
  sendMessage,
  startChatSession,
  getChatHistory,
  getUserChatSessions,
  endChatSession,
  getSessionContext,
  updateSessionContext,
  getChatAnalytics,
  continueSession,
  createSession,
  deleteSession,
  getUserSessions
};