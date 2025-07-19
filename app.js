const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const app = express();

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// CORS configuration for multilingual EdTech platform
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL || 'https://your-edtech-platform.com'
    : ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept-Language']
};
app.use(cors(corsOptions));

// Logging middleware
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Body parsing middleware
app.use(express.json({ limit: '10mb' })); // Increased limit for OCR image uploads
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Language detection middleware
app.use('/api', (req, res, next) => {
  // Extract language from Accept-Language header or query parameter
  const acceptLanguage = req.get('Accept-Language');
  const queryLang = req.query.lang;
  
  // Supported languages for the EdTech platform
  const supportedLanguages = ['hi', 'pa', 'en']; // Hindi, Punjabi, English
  
  let detectedLang = 'en'; // Default to English
  
  if (queryLang && supportedLanguages.includes(queryLang)) {
    detectedLang = queryLang;
  } else if (acceptLanguage) {
    const browserLangs = acceptLanguage.split(',').map(lang => lang.split(';')[0].trim());
    detectedLang = browserLangs.find(lang => supportedLanguages.includes(lang)) || 'en';
  }
  
  req.userLanguage = detectedLang;
  next();
});

// API Routes

// OCR Route - For text extraction from images (supports Hindi, Punjabi, English)
app.use('/api/ocr', (req, res, next) => {
  // OCR-specific middleware can be added here
  next();
}, require('./routes/ocr'));

// Grammar Check Route - For multilingual grammar checking
app.use('/api/grammar', (req, res, next) => {
  // Grammar-specific middleware can be added here
  next();
}, require('./routes/grammar'));

// Speech Route - For text-to-speech and speech-to-text in multiple languages
app.use('/api/speech', (req, res, next) => {
  // Speech processing middleware can be added here
  next();
}, require('./routes/speech'));

// Chat Route - For AI-powered educational chat in Hindi, Punjabi, and English
app.use('/api/chat', (req, res, next) => {
  // Chat-specific middleware (rate limiting, session management)
  next();
}, require('./routes/chat'));

// Export Route - For exporting learning materials and progress
app.use('/api/export', (req, res, next) => {
  // Export-specific middleware can be added here
  next();
}, require('./routes/export'));

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    error: 'API endpoint not found',
    message: `The requested endpoint ${req.originalUrl} does not exist`,
    supportedLanguages: ['hi', 'pa', 'en'],
    availableEndpoints: [
      '/api/ocr',
      '/api/grammar', 
      '/api/speech',
      '/api/chat',
      '/api/export'
    ]
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Error:', error);
  
  // Language-specific error messages
  const errorMessages = {
    en: 'An internal server error occurred',
    hi: 'एक आंतरिक सर्वर त्रुटि हुई',
    pa: 'ਇੱਕ ਅੰਦਰੂਨੀ ਸਰਵਰ ਗਲਤੀ ਆਈ'
  };
  
  const userLang = req.userLanguage || 'en';
  
  res.status(error.status || 500).json({
    error: error.message || errorMessages[userLang],
    language: userLang,
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

module.exports = app;