const express = require('express');
const multer = require('multer');
const ocrController = require('../controllers/ocrController');

const router = express.Router();

// Configure multer for image uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, JPG, and WebP images are allowed'), false);
    }
  }
});

/**
 * @route   POST /api/ocr
 * @desc    Extract text from uploaded image
 * @body    multipart/form-data { image: File, language: 'en' | 'hi' | 'pa' }
 */
// Existing route
router.post('/', upload.single('image'), ocrController.extractText);

// ✅ New route with preprocessing
router.post('/preprocess', upload.single('image'), ocrController.extractTextWithPreprocessing);

// Error handling middleware for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size too large. Maximum size is 5MB.'
      });
    }
  }
  if (
    error.message === 'Only JPEG, PNG, JPG, and WebP images are allowed' ||
    error.message === 'Only image files are allowed'
  ) {
    return res.status(400).json({
      success: false,
      message: 'Only JPEG, PNG, JPG, and WebP images are allowed for OCR processing.'
    });
  }

  // Default error pass-through
  next(error);
});

module.exports = router;
