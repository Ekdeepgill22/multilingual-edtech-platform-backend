const speechService = require('../services/speechService');
const { validationResult } = require('express-validator');

/**
 * Evaluate pronunciation of uploaded voice recording
 * Supports English, Hindi, and Punjabi
 */
const evaluatePronunciation = async (req, res) => {
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

    // Check if audio file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No audio file uploaded'
      });
    }

    const { 
      language = 'en', 
      targetText, 
      evaluationType = 'pronunciation',
      difficulty = 'intermediate' 
    } = req.body;

    const audioBuffer = req.file.buffer;
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
    const allowedMimeTypes = [
      'audio/wav', 'audio/wave', 'audio/x-wav',
      'audio/mpeg', 'audio/mp3',
      'audio/mp4', 'audio/m4a',
      'audio/webm', 'audio/ogg'
    ];
    if (!allowedMimeTypes.includes(mimeType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid audio format. Supported formats: WAV, MP3, M4A, WebM, OGG'
      });
    }

    // Validate file size (max 10MB)
    if (req.file.size > 10 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        message: 'Audio file too large. Maximum size: 10MB'
      });
    }

    // Validate evaluation types
    const supportedEvaluationTypes = ['pronunciation', 'fluency', 'accuracy', 'completeness', 'comprehensive'];
    if (!supportedEvaluationTypes.includes(evaluationType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid evaluation type. Supported types: pronunciation, fluency, accuracy, completeness, comprehensive'
      });
    }

    // Evaluate pronunciation
    const languageCodeMap = {
      en: 'en-IN',
      hi: 'hi-IN',
      pa: 'pa-IN'
    };

    const result = await speechService.transcribeAudio(audioBuffer, {
      languageCode: languageCodeMap[language] || 'en-IN',
      enableAutomaticPunctuation: true
    });

    res.status(200).json({
      success: true,
      message: 'Speech to text conversion completed successfully',
      data: {
        transcribedText: result.fullText,
        confidence: result.transcription?.[0]?.confidence ?? null,
        language: language,
        detectedLanguage: result.detectedLanguage,
        alternatives: result.transcription,
        wordTimestamps: result.transcription?.[0]?.words || [],
        audioMetrics: {
          duration: result.totalDuration,
          sampleRate: 48000, // assuming standard config
          channels: 1
        },
        processingTime: 'N/A'
      }
    });

  } catch (error) {
    console.error('Pronunciation evaluation error:', error);
    
    if (error.message.includes('audio too short')) {
      return res.status(400).json({
        success: false,
        message: 'Audio recording is too short. Minimum duration: 1 second'
      });
    }

    if (error.message.includes('audio too long')) {
      return res.status(400).json({
        success: false,
        message: 'Audio recording is too long. Maximum duration: 5 minutes'
      });
    }

    if (error.message.includes('no speech detected')) {
      return res.status(400).json({
        success: false,
        message: 'No clear speech detected in the audio recording'
      });
    }

    if (error.message.includes('quota exceeded')) {
      return res.status(429).json({
        success: false,
        message: 'Speech evaluation quota exceeded. Please try again later.'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error during pronunciation evaluation',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Convert speech to text (Speech Recognition)
 */
const speechToText = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No audio file uploaded'
      });
    }

    const { language = 'en', enablePunctuation = true } = req.body;
    const audioBuffer = req.file.buffer;
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
    const allowedMimeTypes = [
      'audio/wav', 'audio/wave', 'audio/x-wav',
      'audio/mpeg', 'audio/mp3',
      'audio/mp4', 'audio/m4a',
      'audio/webm', 'audio/ogg'
    ];
    if (!allowedMimeTypes.includes(mimeType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid audio format. Supported formats: WAV, MP3, M4A, WebM, OGG'
      });
    }

    // Validate file size (max 10MB)
    if (req.file.size > 10 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        message: 'Audio file too large. Maximum size: 10MB'
      });
    }

    // Map language codes
    const languageCodeMap = {
      en: 'en-IN',
      hi: 'hi-IN',
      pa: 'pa-IN'
    };

    // Use the existing transcribeAudio function with proper parameters
    const result = await speechService.transcribeAudio(audioBuffer, {
      languageCode: languageCodeMap[language] || 'en-IN',
      enableAutomaticPunctuation: enablePunctuation === 'true' || enablePunctuation === true,
      mimeType: mimeType
    });

    res.status(200).json({
      success: true,
      message: 'Speech to text conversion completed successfully',
      data: {
        transcribedText: result.fullText,
        confidence: result.transcription?.[0]?.confidence ?? null,
        language: language,
        detectedLanguage: result.detectedLanguage,
        alternatives: result.transcription,
        wordTimestamps: result.transcription?.[0]?.words || [],
        speakerInfo: result.speakerInfo || null,
        audioMetrics: {
          duration: result.totalDuration,
          sampleRate: 48000, // assuming standard config
          channels: 1
        },
        processingTime: result.processingTime || 'N/A'
      }
    });

  } catch (error) {
    console.error('Speech to text error:', error);
    
    // Handle specific error cases
    if (error.message.includes('audio too short')) {
      return res.status(400).json({
        success: false,
        message: 'Audio recording is too short. Minimum duration: 1 second'
      });
    }

    if (error.message.includes('audio too long')) {
      return res.status(400).json({
        success: false,
        message: 'Audio recording is too long. Maximum duration: 5 minutes'
      });
    }

    if (error.message.includes('no speech detected')) {
      return res.status(400).json({
        success: false,
        message: 'No clear speech detected in the audio recording'
      });
    }

    if (error.message.includes('quota exceeded')) {
      return res.status(429).json({
        success: false,
        message: 'Speech recognition quota exceeded. Please try again later.'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to convert speech to text',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Generate pronunciation practice exercises
 */
const generatePracticeExercises = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { 
      language = 'en', 
      difficulty = 'intermediate',
      focusAreas = [],
      exerciseCount = 5 
    } = req.body;

    if (exerciseCount > 20) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 20 exercises allowed per request'
      });
    }

    const exercises = await speechService.generatePracticeExercises({
      language,
      difficulty,
      focusAreas,
      exerciseCount
    });

    res.status(200).json({
      success: true,
      message: 'Practice exercises generated successfully',
      data: {
        exercises: exercises.exercises,
        metadata: {
          language,
          difficulty,
          focusAreas,
          totalExercises: exercises.exercises.length
        },
        instructions: exercises.instructions,
        tips: exercises.tips
      }
    });

  } catch (error) {
    console.error('Generate practice exercises error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate practice exercises',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get pronunciation assessment history
 */
const getPronunciationHistory = async (req, res) => {
  try {
    const { userId } = req.user; // Assuming user is attached via auth middleware
    const { page = 1, limit = 10, language, evaluationType } = req.query;

    const history = await speechService.getUserPronunciationHistory(userId, {
      page: parseInt(page),
      limit: parseInt(limit),
      language,
      evaluationType
    });

    res.status(200).json({
      success: true,
      message: 'Pronunciation history retrieved successfully',
      data: history
    });

  } catch (error) {
    console.error('Get pronunciation history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve pronunciation history',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get pronunciation statistics and progress
 */
const getPronunciationStats = async (req, res) => {
  try {
    const { userId } = req.user;
    const { timeRange = '30d', language } = req.query;

    const stats = await speechService.getUserPronunciationStats(userId, timeRange, language);

    res.status(200).json({
      success: true,
      message: 'Pronunciation statistics retrieved successfully',
      data: stats
    });

  } catch (error) {
    console.error('Get pronunciation stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve pronunciation statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Delete pronunciation record
 */
const deletePronunciationRecord = async (req, res) => {
  try {
    const { recordId } = req.params;
    const { userId } = req.user;

    const deleted = await speechService.deletePronunciationRecord(recordId, userId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Pronunciation record not found or access denied'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Pronunciation record deleted successfully'
    });

  } catch (error) {
    console.error('Delete pronunciation record error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete pronunciation record',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const textToSpeech = async (req, res) => {
  // TODO: Implement text-to-speech logic
  res.status(501).json({ message: 'Not Implemented' });
};

module.exports = {
  evaluatePronunciation,
  speechToText,
  textToSpeech,
  generatePracticeExercises,
  getPronunciationHistory,
  getPronunciationStats,
  deletePronunciationRecord
};