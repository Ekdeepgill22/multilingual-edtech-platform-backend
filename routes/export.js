const express = require('express');
const exportController = require('../controllers/exportController');

const router = express.Router();

// Validation middleware for export requests
const validateExportRequest = (req, res, next) => {
  const { data, format, filename } = req.body;
  
  if (!data) {
    return res.status(400).json({
      success: false,
      message: 'Data is required for export.'
    });
  }
  
  const supportedFormats = ['pdf', 'docx', 'txt', 'json', 'csv'];
  if (!format || !supportedFormats.includes(format.toLowerCase())) {
    return res.status(400).json({
      success: false,
      message: 'Supported export formats are: PDF, DOCX, TXT, JSON, CSV.'
    });
  }
  
  // Validate filename if provided
  if (filename && (typeof filename !== 'string' || filename.trim().length === 0)) {
    return res.status(400).json({
      success: false,
      message: 'Filename must be a valid string.'
    });
  }
  
  next();
};

// Validation middleware for session export
const validateSessionExportRequest = (req, res, next) => {
  const { sessionId } = req.params;
  const { format } = req.body;
  
  if (!sessionId || sessionId.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Session ID is required for session export.'
    });
  }
  
  const supportedFormats = ['pdf', 'docx', 'txt', 'json'];
  if (!format || !supportedFormats.includes(format.toLowerCase())) {
    return res.status(400).json({
      success: false,
      message: 'Supported export formats for sessions are: PDF, DOCX, TXT, JSON.'
    });
  }
  
  next();
};

// POST /api/export - Export general data to specified format
router.post('/', validateExportRequest, exportController.exportData);

// POST /api/export/session/:sessionId - Export chat session to specified format
router.post('/session/:sessionId', validateSessionExportRequest, exportController.exportSession);

// POST /api/export/grammar-report - Export grammar analysis report
router.post('/grammar-report', validateExportRequest, exportController.exportGrammarReport);

// POST /api/export/speech-report - Export speech analysis report
router.post('/speech-report', validateExportRequest, exportController.exportSpeechReport);

// POST /api/export/progress-report - Export learning progress report
router.post('/progress-report', validateExportRequest, exportController.exportProgressReport);

// GET /api/export/templates - Get available export templates
router.get('/templates', exportController.getExportTemplates);

// POST /api/export/bulk - Export multiple items in bulk
router.post('/bulk', (req, res, next) => {
  const { items, format } = req.body;
  
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Items array is required for bulk export.'
    });
  }
  
  const supportedFormats = ['zip', 'pdf', 'json'];
  if (!format || !supportedFormats.includes(format.toLowerCase())) {
    return res.status(400).json({
      success: false,
      message: 'Supported bulk export formats are: ZIP, PDF, JSON.'
    });
  }
  
  next();
}, exportController.exportBulk);

module.exports = router;