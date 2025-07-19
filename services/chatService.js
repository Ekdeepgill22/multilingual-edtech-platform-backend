// services/chatService.js
const dialogflow = require('@google-cloud/dialogflow');
const { v4: uuidv4 } = require('uuid');

class ChatService {
  constructor() {
    // Initialize Dialogflow client
    // Ensure GOOGLE_APPLICATION_CREDENTIALS is set or pass keyFilename
    this.sessionClient = new dialogflow.SessionsClient({
      // keyFilename: 'path/to/service-account-key.json', // Optional
    });

    // Project configuration - set these in environment variables
    this.projectId = process.env.DIALOGFLOW_PROJECT_ID || 'your-project-id';
    this.location = process.env.DIALOGFLOW_LOCATION || 'global'; // or 'us-central1', etc.
    
    // Language code mappings for multilingual support
    this.languageCodes = {
      hindi: 'hi',
      punjabi: 'pa', 
      english: 'en'
    };

    // Default session configuration
    this.defaultSessionConfig = {
      timeZone: 'Asia/Kolkata',
      session: null
    };

    // Context management for educational conversations
    this.activeContexts = new Map();
  }

  /**
   * Send message to Dialogflow agent and get response
   * @param {string} message - User message
   * @param {string} sessionId - Session ID for conversation continuity
   * @param {string} language - Language code (hindi/punjabi/english)
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} - Dialogflow response with educational context
   */
  async sendMessage(message, sessionId, language = 'english', options = {}) {
    try {
      if (!message || message.trim().length === 0) {
        throw new Error('Message is required');
      }

      if (!sessionId) {
        sessionId = this.generateSessionId();
      }

      const languageCode = this.getLanguageCode(language);
      const sessionPath = this.sessionClient.projectLocationAgentSessionPath(
        this.projectId,
        this.location,
        options.agentId || 'default-agent',
        sessionId
      );

      // Build request with educational context
      const request = {
        session: sessionPath,
        queryInput: {
          text: {
            text: message,
            languageCode: languageCode
          }
        },
        queryParams: {
          timeZone: options.timeZone || this.defaultSessionConfig.timeZone,
          ...this.buildEducationalContext(sessionId, options)
        }
      };

      console.log(`Sending message to Dialogflow: "${message}" (${language})`);
      const [response] = await this.sessionClient.detectIntent(request);

      // Process and enhance response for educational context
      const processedResponse = await this.processEducationalResponse(
        response, 
        sessionId, 
        language,
        options
      );

      // Update conversation context
      this.updateConversationContext(sessionId, message, processedResponse);

      return {
        success: true,
        sessionId: sessionId,
        response: processedResponse,
        originalDialogflowResponse: response
      };

    } catch (error) {
      console.error('Dialogflow chat error:', error);
      throw new Error(`Chat service failed: ${error.message}`);
    }
  }

  /**
   * Send educational query with subject context
   * @param {string} question - Educational question
   * @param {string} subject - Subject area (math, science, language, etc.)
   * @param {string} sessionId - Session ID
   * @param {string} language - Language preference
   * @param {Object} options - Educational options
   * @returns {Promise<Object>} - Educational response
   */
  async sendEducationalQuery(question, subject, sessionId, language = 'english', options = {}) {
    try {
      // Enhance question with educational context
      const enhancedMessage = this.buildEducationalQuery(question, subject, options);
      
      const educationalOptions = {
        ...options,
        context: 'educational',
        subject: subject,
        studentLevel: options.studentLevel || 'intermediate',
        learningStyle: options.learningStyle || 'comprehensive'
      };

      return await this.sendMessage(enhancedMessage, sessionId, language, educationalOptions);

    } catch (error) {
      console.error('Educational query error:', error);
      throw new Error(`Educational query failed: ${error.message}`);
    }
  }

  /**
   * Get conversation history for a session
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>} - Conversation history
   */
  async getConversationHistory(sessionId) {
    try {
      const context = this.activeContexts.get(sessionId);
      
      if (!context) {
        return {
          success: true,
          sessionId: sessionId,
          history: [],
          totalMessages: 0
        };
      }

      return {
        success: true,
        sessionId: sessionId,
        history: context.messages || [],
        totalMessages: (context.messages || []).length,
        subjects: context.subjects || [],
        startTime: context.startTime,
        lastActivity: context.lastActivity
      };

    } catch (error) {
      console.error('Conversation history error:', error);
      throw new Error(`Failed to get conversation history: ${error.message}`);
    }
  }

  /**
   * Clear conversation context for a session
   * @param {string} sessionId - Session ID to clear
   * @returns {Promise<Object>} - Clear operation result
   */
  async clearConversation(sessionId) {
    try {
      // Clear Dialogflow session context
      const sessionPath = this.sessionClient.projectLocationAgentSessionPath(
        this.projectId,
        this.location,
        'default-agent',
        sessionId
      );

      // Delete all contexts for this session
      const contextsClient = new dialogflow.ContextsClient();
      const contexts = await contextsClient.listContexts({
        parent: sessionPath
      });

      for (const context of contexts[0]) {
        await contextsClient.deleteContext({
          name: context.name
        });
      }

      // Clear local context
      this.activeContexts.delete(sessionId);

      return {
        success: true,
        sessionId: sessionId,
        message: 'Conversation cleared successfully'
      };

    } catch (error) {
      console.error('Clear conversation error:', error);
      throw new Error(`Failed to clear conversation: ${error.message}`);
    }
  }

  /**
   * Set educational preferences for a session
   * @param {string} sessionId - Session ID
   * @param {Object} preferences - Educational preferences
   * @returns {Promise<Object>} - Preference setting result
   */
  async setEducationalPreferences(sessionId, preferences) {
    try {
      let context = this.activeContexts.get(sessionId) || this.createNewContext(sessionId);
      
      context.preferences = {
        ...context.preferences,
        ...preferences
      };

      this.activeContexts.set(sessionId, context);

      return {
        success: true,
        sessionId: sessionId,
        preferences: context.preferences,
        message: 'Educational preferences updated'
      };

    } catch (error) {
      console.error('Set preferences error:', error);
      throw new Error(`Failed to set preferences: ${error.message}`);
    }
  }

  /**
   * Generate unique session ID
   * @returns {string} - Unique session ID
   */
  generateSessionId() {
    return `session-${uuidv4()}`;
  }

  /**
   * Get Dialogflow language code from our language names
   * @private
   */
  getLanguageCode(language) {
    const normalizedLanguage = language.toLowerCase();
    return this.languageCodes[normalizedLanguage] || 'en';
  }

  /**
   * Build educational context for Dialogflow request
   * @private
   */
  buildEducationalContext(sessionId, options) {
    const context = this.activeContexts.get(sessionId);
    const educationalParams = {};

    if (options.context === 'educational') {
      educationalParams.parameters = {
        subject: options.subject,
        studentLevel: options.studentLevel,
        learningStyle: options.learningStyle,
        previousTopics: context?.subjects || []
      };
    }

    return educationalParams;
  }

  /**
   * Build enhanced educational query
   * @private
   */
  buildEducationalQuery(question, subject, options) {
    const level = options.studentLevel || 'intermediate';
    const style = options.learningStyle || 'comprehensive';
    
    // Add educational context to the question
    let enhancedQuery = question;
    
    if (subject) {
      enhancedQuery = `[Subject: ${subject}] ${question}`;
    }
    
    if (level !== 'intermediate') {
      enhancedQuery = `[Level: ${level}] ${enhancedQuery}`;
    }
    
    if (options.requireExamples) {
      enhancedQuery += ' Please provide examples.';
    }
    
    if (options.requireSteps) {
      enhancedQuery += ' Please explain step by step.';
    }

    return enhancedQuery;
  }

  /**
   * Process Dialogflow response for educational enhancement
   * @private
   */
  async processEducationalResponse(response, sessionId, language, options) {
    const fulfillmentText = response.queryResult.fulfillmentText;
    const intent = response.queryResult.intent;
    const confidence = response.queryResult.intentDetectionConfidence;

    // Extract educational metadata
    const educationalMetadata = this.extractEducationalMetadata(response);

    // Enhance response based on educational context
    let enhancedResponse = fulfillmentText;
    if (options.context === 'educational' && confidence > 0.7) {
      enhancedResponse = await this.enhanceEducationalResponse(
        fulfillmentText, 
        options.subject,
        language
      );
    }

    return {
      text: enhancedResponse,
      originalText: fulfillmentText,
      intent: intent ? intent.displayName : 'Unknown',
      confidence: confidence,
      language: language,
      educational: {
        subject: options.subject,
        metadata: educationalMetadata,
        suggestions: this.generateEducationalSuggestions(response, options)
      },
      parameters: response.queryResult.parameters,
      contexts: response.queryResult.outputContexts
    };
  }

  /**
   * Extract educational metadata from Dialogflow response
   * @private
   */
  extractEducationalMetadata(response) {
    const parameters = response.queryResult.parameters;
    return {
      difficulty: parameters?.difficulty || 'medium',
      topics: parameters?.topics || [],
      concepts: parameters?.concepts || [],
      nextSteps: parameters?.nextSteps || []
    };
  }

  /**
   * Enhance response for educational context
   * @private
   */
  async enhanceEducationalResponse(text, subject, language) {
    // This could integrate with your grammar service for language-specific enhancements
    // For now, return enhanced formatting
    
    if (subject && text.length > 100) {
      return `📚 **${subject.toUpperCase()}**\n\n${text}\n\n💡 *Need more help with this topic? Just ask!*`;
    }
    
    return text;
  }

  /**
   * Generate educational suggestions based on response
   * @private
   */
  generateEducationalSuggestions(response, options) {
    const suggestions = [];
    const confidence = response.queryResult.intentDetectionConfidence;
    
    if (confidence < 0.6) {
      suggestions.push('Try rephrasing your question for better understanding');
    }
    
    if (options.subject) {
      suggestions.push(`Ask about related ${options.subject} topics`);
      suggestions.push(`Request practice problems in ${options.subject}`);
    }
    
    suggestions.push('Ask for examples or step-by-step explanations');
    
    return suggestions;
  }

  /**
   * Update conversation context
   * @private
   */
  updateConversationContext(sessionId, message, response) {
    let context = this.activeContexts.get(sessionId) || this.createNewContext(sessionId);
    
    // Add message to history
    const messageEntry = {
      timestamp: new Date().toISOString(),
      userMessage: message,
      botResponse: response.text,
      intent: response.intent,
      confidence: response.confidence,
      subject: response.educational?.subject
    };
    
    context.messages.push(messageEntry);
    context.lastActivity = new Date().toISOString();
    
    // Track subjects
    if (response.educational?.subject) {
      if (!context.subjects.includes(response.educational.subject)) {
        context.subjects.push(response.educational.subject);
      }
    }
    
    // Keep only last 50 messages to prevent memory issues
    if (context.messages.length > 50) {
      context.messages = context.messages.slice(-50);
    }
    
    this.activeContexts.set(sessionId, context);
  }

  /**
   * Create new conversation context
   * @private
   */
  createNewContext(sessionId) {
    return {
      sessionId: sessionId,
      startTime: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      messages: [],
      subjects: [],
      preferences: {}
    };
  }

  /**
   * Get available intents from Dialogflow agent
   * @returns {Promise<Object>} - Available intents
   */
  async getAvailableIntents() {
    try {
      const intentsClient = new dialogflow.IntentsClient();
      const agentPath = intentsClient.projectLocationAgentPath(
        this.projectId, 
        this.location,
        'default-agent'
      );
      
      const [intents] = await intentsClient.listIntents({
        parent: agentPath
      });

      return {
        success: true,
        intents: intents.map(intent => ({
          name: intent.displayName,
          trainingPhrases: intent.trainingPhrases?.length || 0
        }))
      };

    } catch (error) {
      console.error('Get intents error:', error);
      throw new Error(`Failed to get intents: ${error.message}`);
    }
  }
}

module.exports = new ChatService();