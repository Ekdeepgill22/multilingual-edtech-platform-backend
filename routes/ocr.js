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
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// POST /api/ocr - Extract text from uploaded image
router.post('/', upload.single('image'), ocrController.extractText);

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
  if (error.message === 'Only image files are allowed') {
    return res.status(400).json({
      success: false,
      message: 'Only image files are allowed for OCR processing.'
    });
  }
  next(error);
});

module.exports = router;