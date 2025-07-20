const exportService = require('../services/docExportService');
const { validationResult } = require('express-validator');

/**
 * Convert extracted text to downloadable .docx document
 * Supports formatted documents with multilingual content
 */
const exportToDocx = async (req, res) => {
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
      text,
      title = 'Extracted Text Document',
      language = 'en',
      formatting = {},
      metadata = {}
    } = req.body;

    // Validate input
    if (!text || text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Text content is required for document export'
      });
    }

    if (text.length > 100000) {
      return res.status(400).json({
        success: false,
        message: 'Text content exceeds maximum length of 100,000 characters'
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

    const { userId } = req.user; // Assuming user is attached via auth middleware

    // Generate DOCX document
    const docBuffer = await exportService.generateDocxDocument({
      text,
      title,
      language,
      formatting,
      metadata: {
        ...metadata,
        createdBy: userId,
        createdAt: new Date().toISOString(),
        platform: 'EdTech Multilingual Platform'
      }
    });

    // Set appropriate headers for file download
    const filename = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${Date.now()}.docx`;
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', docBuffer.length);
    res.setHeader('Cache-Control', 'no-cache');

    // Log export activity
    await exportService.logExportActivity({
      userId,
      exportType: 'docx',
      language,
      contentLength: text.length,
      filename
    });

    res.status(200).send(docBuffer);

  } catch (error) {
    console.error('DOCX export error:', error);
    
    if (error.message.includes('invalid formatting')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid formatting options provided'
      });
    }

    if (error.message.includes('font not supported')) {
      return res.status(400).json({
        success: false,
        message: 'Specified font is not supported for the selected language'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error during document export',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Export to PDF format
 */
const exportToPdf = async (req, res) => {
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
      text,
      title = 'Extracted Text Document',
      language = 'en',
      formatting = {},
      pageSettings = {},
      metadata = {}
    } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Text content is required for PDF export'
      });
    }

    const { userId } = req.user;

    // Generate PDF document
    const pdfBuffer = await exportService.generatePdfDocument({
      text,
      title,
      language,
      formatting,
      pageSettings,
      metadata: {
        ...metadata,
        createdBy: userId,
        createdAt: new Date().toISOString(),
        platform: 'EdTech Multilingual Platform'
      }
    });

    const filename = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${Date.now()}.pdf`;
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Cache-Control', 'no-cache');

    // Log export activity
    await exportService.logExportActivity({
      userId,
      exportType: 'pdf',
      language,
      contentLength: text.length,
      filename
    });

    res.status(200).send(pdfBuffer);

  } catch (error) {
    console.error('PDF export error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during PDF export',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Export to plain text format
 */
const exportToText = async (req, res) => {
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
      text,
      title = 'Extracted Text Document',
      language = 'en',
      includeMetadata = false,
      metadata = {}
    } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Text content is required for text export'
      });
    }

    const { userId } = req.user;

    // Generate text document
    const textContent = await exportService.generateTextDocument({
      text,
      title,
      language,
      includeMetadata,
      metadata: {
        ...metadata,
        createdBy: userId,
        createdAt: new Date().toISOString(),
        platform: 'EdTech Multilingual Platform'
      }
    });

    const filename = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${Date.now()}.txt`;
    
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', Buffer.byteLength(textContent, 'utf8'));
    res.setHeader('Cache-Control', 'no-cache');

    // Log export activity
    await exportService.logExportActivity({
      userId,
      exportType: 'txt',
      language,
      contentLength: text.length,
      filename
    });

    res.status(200).send(textContent);

  } catch (error) {
    console.error('Text export error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during text export',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Export grammar check results to formatted document
 */
const exportGrammarReport = async (req, res) => {
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
      originalText,
      correctedText,
      errors: grammarErrors,
      suggestions,
      language = 'en',
      format = 'docx',
      includeExplanations = true
    } = req.body;

    if (!originalText || !correctedText) {
      return res.status(400).json({
        success: false,
        message: 'Original text and corrected text are required'
      });
    }

    const supportedFormats = ['docx', 'pdf', 'html'];
    if (!supportedFormats.includes(format)) {
      return res.status(400).json({
        success: false,
        message: 'Unsupported format. Supported formats: docx, pdf, html'
      });
    }

    const { userId } = req.user;

    // Generate grammar report
    const reportBuffer = await exportService.generateGrammarReport({
      originalText,
      correctedText,
      errors: grammarErrors,
      suggestions,
      language,
      format,
      includeExplanations,
      metadata: {
        createdBy: userId,
        createdAt: new Date().toISOString(),
        platform: 'EdTech Multilingual Platform'
      }
    });

    const filename = `grammar_report_${Date.now()}.${format}`;
    const contentTypes = {
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      pdf: 'application/pdf',
      html: 'text/html'
    };
    
    res.setHeader('Content-Type', contentTypes[format]);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', reportBuffer.length);
    res.setHeader('Cache-Control', 'no-cache');

    // Log export activity
    await exportService.logExportActivity({
      userId,
      exportType: `grammar_report_${format}`,
      language,
      contentLength: originalText.length,
      filename
    });

    res.status(200).send(reportBuffer);

  } catch (error) {
    console.error('Grammar report export error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during grammar report export',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Export pronunciation analysis report
 */
const exportPronunciationReport = async (req, res) => {
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
      analysisData,
      language = 'en',
      format = 'pdf',
      includeAudioMetrics = true,
      includeRecommendations = true
    } = req.body;

    if (!analysisData || !analysisData.overallScore) {
      return res.status(400).json({
        success: false,
        message: 'Pronunciation analysis data is required'
      });
    }

    const { userId } = req.user;

    // Generate pronunciation report
    const reportBuffer = await exportService.generatePronunciationReport({
      analysisData,
      language,
      format,
      includeAudioMetrics,
      includeRecommendations,
      metadata: {
        createdBy: userId,
        createdAt: new Date().toISOString(),
        platform: 'EdTech Multilingual Platform'
      }
    });

    const filename = `pronunciation_report_${Date.now()}.${format}`;
    const contentTypes = {
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      pdf: 'application/pdf',
      html: 'text/html'
    };
    
    res.setHeader('Content-Type', contentTypes[format]);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', reportBuffer.length);
    res.setHeader('Cache-Control', 'no-cache');

    // Log export activity
    await exportService.logExportActivity({
      userId,
      exportType: `pronunciation_report_${format}`,
      language,
      contentLength: JSON.stringify(analysisData).length,
      filename
    });

    res.status(200).send(reportBuffer);

  } catch (error) {
    console.error('Pronunciation report export error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during pronunciation report export',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get user's export history
 */
const getExportHistory = async (req, res) => {
  try {
    const { userId } = req.user;
    const { page = 1, limit = 20, exportType, language, dateRange } = req.query;

    const history = await exportService.getUserExportHistory(userId, {
      page: parseInt(page),
      limit: parseInt(limit),
      exportType,
      language,
      dateRange
    });

    res.status(200).json({
      success: true,
      message: 'Export history retrieved successfully',
      data: history
    });

  } catch (error) {
    console.error('Get export history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve export history',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get export statistics for a user
 */
const getExportStats = async (req, res) => {
  try {
    const { userId } = req.user;
    const { timeRange = '30d' } = req.query;

    const stats = await exportService.getUserExportStats(userId, timeRange);

    res.status(200).json({
      success: true,
      message: 'Export statistics retrieved successfully',
      data: stats
    });

  } catch (error) {
    console.error('Get export stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve export statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const exportData = async (req, res) => {
  // TODO: Implement export data logic
  res.status(501).json({ message: 'Not Implemented' });
};

const exportSession = async (req, res) => {
  // TODO: Implement export session logic
  res.status(501).json({ message: 'Not Implemented' });
};

const exportSpeechReport = async (req, res) => {
  // TODO: Implement export speech report logic
  res.status(501).json({ message: 'Not Implemented' });
};

const exportProgressReport = async (req, res) => {
  // TODO: Implement export progress report logic
  res.status(501).json({ message: 'Not Implemented' });
};

const getExportTemplates = async (req, res) => {
  // TODO: Implement get export templates logic
  res.status(501).json({ message: 'Not Implemented' });
};

const exportBulk = async (req, res) => {
  // TODO: Implement export bulk logic
  res.status(501).json({ message: 'Not Implemented' });
};

module.exports = {
  exportToDocx,
  exportToPdf,
  exportToText,
  exportGrammarReport,
  exportPronunciationReport,
  getExportHistory,
  getExportStats,
  exportData,
  exportSession,
  exportSpeechReport,
  exportProgressReport,
  getExportTemplates,
  exportBulk
};