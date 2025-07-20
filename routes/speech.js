const express = require('express');
const multer = require('multer');
const speechController = require('../controllers/speechController');

const router = express.Router();

// Configure multer for audio uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for audio files
  },
  fileFilter: (req, file, cb) => {
    // Accept only audio files
    if (file.mimetype.startsWith('audio/') || 
        ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/m4a', 'audio/webm'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'), false);
    }
  }
});

// Validation middleware for text-to-speech requests
const validateTTSRequest = (req, res, next) => {
  const { text, language, voice } = req.body;
  
  if (!text || text.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Text is required for speech synthesis.'
    });
  }
  
  const supportedLanguages = ['english', 'hindi', 'punjabi'];
  if (language && !supportedLanguages.includes(language.toLowerCase())) {
    return res.status(400).json({
      success: false,
      message: 'Supported languages are: English, Hindi, Punjabi.'
    });
  }
  
  next();
};

// POST /api/speech - Convert audio to text (Speech-to-Text)
router.post('/', upload.single('audio'), speechController.speechToText);

// POST /api/speech/synthesize - Convert text to speech (Text-to-Speech)
router.post('/synthesize', validateTTSRequest, speechController.textToSpeech);

// POST /api/speech/analyze - Analyze pronunciation and fluency
router.post('/analyze', upload.single('audio'), speechController.evaluatePronunciation);


// Error handling middleware for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'Audio file size too large. Maximum size is 10MB.'
      });
    }
  }
  if (error.message === 'Only audio files are allowed') {
    return res.status(400).json({
      success: false,
      message: 'Only audio files are allowed for speech processing.'
    });
  }
  next(error);
});

module.exports = router;