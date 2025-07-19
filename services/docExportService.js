// services/docExportService.js
const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } = require('docx');
const fs = require('fs').promises;
const path = require('path');

class DocExportService {
  constructor() {
    // Default document styling
    this.defaultStyles = {
      font: 'Arial',
      fontSize: 24, // 12pt in half-points
      lineSpacing: 300, // 1.15 line spacing
      margins: {
        top: 720, // 0.5 inch in twips (1440 twips = 1 inch)
        right: 720,
        bottom: 720,
        left: 720
      }
    };

    // Language-specific font mappings for better rendering
    this.languageFonts = {
      hindi: 'Noto Sans Devanagari',
      punjabi: 'Noto Sans Gurmukhi', 
      english: 'Arial',
      mixed: 'Noto Sans'
    };

    // Document templates
    this.templates = {
      educational: {
        title: 'Educational Content',
        headerColor: '2E7D32',
        accentColor: '4CAF50'
      },
      grammar: {
        title: 'Grammar Analysis Report',
        headerColor: '1976D2',
        accentColor: '2196F3'
      },
      transcription: {
        title: 'Audio Transcription',
        headerColor: '7B1FA2',
        accentColor: '9C27B0'
      },
      ocr: {
        title: 'Handwriting Recognition',
        headerColor: 'D84315',
        accentColor: 'FF5722'
      },
      notes: {
        title: 'Study Notes',
        headerColor: '5D4037',
        accentColor: '795548'
      }
    };
  }

  /**
   * Generate Word document from text content
   * @param {string|Object} content - Text content or structured content object
   * @param {Object} options - Export options
   * @returns {Promise<Buffer>} - Generated document buffer
   */
  async generateDocument(content, options = {}) {
    try {
      const documentConfig = this.buildDocumentConfig(options);
      const sections = await this.processContent(content, options);

      const doc = new Document({
        ...documentConfig,
        sections: sections
      });

      console.log('Generating Word document...');
      const buffer = await Packer.toBuffer(doc);
      
      return {
        success: true,
        buffer: buffer,
        filename: this.generateFilename(options),
        size: buffer.length,
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      };

    } catch (error) {
      console.error('Document generation error:', error);
      throw new Error(`Document generation failed: ${error.message}`);
    }
  }

  /**
   * Export educational content to Word document
   * @param {Object} educationalData - Educational content data
   * @param {Object} options - Export options
   * @returns {Promise<Buffer>} - Generated educational document
   */
  async exportEducationalContent(educationalData, options = {}) {
    try {
      const template = this.templates.educational;
      const exportOptions = {
        ...options,
        template: 'educational',
        title: educationalData.title || template.title,
        includeMetadata: true
      };

      // Structure educational content
      const structuredContent = {
        title: educationalData.title || 'Educational Content',
        sections: [
          {
            heading: 'Subject',
            content: educationalData.subject || 'General',
            type: 'metadata'
          },
          {
            heading: 'Level',
            content: educationalData.level || 'Intermediate',
            type: 'metadata'
          },
          {
            heading: 'Content',
            content: educationalData.content || educationalData.text,
            type: 'main'
          }
        ]
      };

      // Add grammar analysis if available
      if (educationalData.grammarAnalysis) {
        structuredContent.sections.push({
          heading: 'Grammar Analysis',
          content: this.formatGrammarAnalysis(educationalData.grammarAnalysis),
          type: 'analysis'
        });
      }

      // Add suggestions if available
      if (educationalData.suggestions && educationalData.suggestions.length > 0) {
        structuredContent.sections.push({
          heading: 'Suggestions for Improvement',
          content: educationalData.suggestions,
          type: 'list'
        });
      }

      return await this.generateDocument(structuredContent, exportOptions);

    } catch (error) {
      console.error('Educational content export error:', error);
      throw new Error(`Educational content export failed: ${error.message}`);
    }
  }

  /**
   * Export grammar analysis report
   * @param {Object} grammarData - Grammar analysis data
   * @param {Object} options - Export options
   * @returns {Promise<Buffer>} - Generated grammar report
   */
  async exportGrammarReport(grammarData, options = {}) {
    try {
      const template = this.templates.grammar;
      const exportOptions = {
        ...options,
        template: 'grammar',
        title: 'Grammar Analysis Report'
      };

      const structuredContent = {
        title: 'Grammar Analysis Report',
        sections: [
          {
            heading: 'Original Text',
            content: grammarData.original,
            type: 'original'
          },
          {
            heading: 'Corrected Text',
            content: grammarData.corrected,
            type: 'corrected'
          },
          {
            heading: 'Changes Made',
            content: grammarData.changes || [],
            type: 'changes'
          },
          {
            heading: 'Analysis',
            content: [
              `Language: ${grammarData.language || 'Unknown'}`,
              `Confidence: ${((grammarData.confidence || 0) * 100).toFixed(1)}%`,
              `Number of corrections: ${(grammarData.changes || []).length}`
            ],
            type: 'metadata'
          }
        ]
      };

      if (grammarData.suggestions && grammarData.suggestions.length > 0) {
        structuredContent.sections.push({
          heading: 'Additional Suggestions',
          content: grammarData.suggestions,
          type: 'list'
        });
      }

      return await this.generateDocument(structuredContent, exportOptions);

    } catch (error) {
      console.error('Grammar report export error:', error);
      throw new Error(`Grammar report export failed: ${error.message}`);
    }
  }

  /**
   * Export transcription to Word document
   * @param {Object} transcriptionData - Transcription data
   * @param {Object} options - Export options
   * @returns {Promise<Buffer>} - Generated transcription document
   */
  async exportTranscription(transcriptionData, options = {}) {
    try {
      const template = this.templates.transcription;
      const exportOptions = {
        ...options,
        template: 'transcription',
        title: 'Audio Transcription'
      };

      const structuredContent = {
        title: 'Audio Transcription',
        sections: [
          {
            heading: 'Transcription Details',
            content: [
              `Language: ${transcriptionData.detectedLanguage || 'Unknown'}`,
              `Duration: ${transcriptionData.totalDuration || 'Unknown'} seconds`,
              `Word Count: ${transcriptionData.wordCount || 0}`,
              `Date: ${new Date().toLocaleDateString()}`
            ],
            type: 'metadata'
          },
          {
            heading: 'Full Transcription',
            content: transcriptionData.fullText || transcriptionData.text,
            type: 'main'
          }
        ]
      };

      // Add detailed word timestamps if available
      if (transcriptionData.transcription && options.includeTimestamps) {
        const timestampContent = this.formatTranscriptionWithTimestamps(transcriptionData.transcription);
        structuredContent.sections.push({
          heading: 'Detailed Transcription with Timestamps',
          content: timestampContent,
          type: 'timestamps'
        });
      }

      return await this.generateDocument(structuredContent, exportOptions);

    } catch (error) {
      console.error('Transcription export error:', error);
      throw new Error(`Transcription export failed: ${error.message}`);
    }
  }

  /**
   * Export OCR results to Word document
   * @param {Object} ocrData - OCR results data
   * @param {Object} options - Export options
   * @returns {Promise<Buffer>} - Generated OCR document
   */
  async exportOCRResults(ocrData, options = {}) {
    try {
      const template = this.templates.ocr;
      const exportOptions = {
        ...options,
        template: 'ocr',
        title: 'Handwriting Recognition Results'
      };

      const structuredContent = {
        title: 'Handwriting Recognition Results',
        sections: [
          {
            heading: 'Recognition Details',
            content: [
              `Language: ${ocrData.language || 'Unknown'}`,
              `Confidence: ${((ocrData.confidence || 0) * 100).toFixed(1)}%`,
              `Processing Date: ${new Date().toLocaleDateString()}`
            ],
            type: 'metadata'
          },
          {
            heading: 'Extracted Text',
            content: ocrData.text,
            type: 'main'
          }
        ]
      };

      // Add word-level confidence if available
      if (ocrData.words && options.includeWordDetails) {
        const wordDetails = this.formatWordConfidenceDetails(ocrData.words);
        structuredContent.sections.push({
          heading: 'Word-by-Word Analysis',
          content: wordDetails,
          type: 'word-analysis'
        });
      }

      return await this.generateDocument(structuredContent, exportOptions);

    } catch (error) {
      console.error('OCR export error:', error);
      throw new Error(`OCR export failed: ${error.message}`);
    }
  }

  /**
   * Save document to file system
   * @param {Buffer} documentBuffer - Document buffer
   * @param {string} filename - Output filename
   * @param {string} outputPath - Output directory path
   * @returns {Promise<Object>} - Save operation result
   */
  async saveDocumentToFile(documentBuffer, filename, outputPath = './exports') {
    try {
      // Ensure output directory exists
      await fs.mkdir(outputPath, { recursive: true });
      
      const fullPath = path.join(outputPath, filename);
      await fs.writeFile(fullPath, documentBuffer);
      
      const stats = await fs.stat(fullPath);
      
      return {
        success: true,
        filePath: fullPath,
        filename: filename,
        size: stats.size,
        savedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('Document save error:', error);
      throw new Error(`Failed to save document: ${error.message}`);
    }
  }

  /**
   * Build document configuration
   * @private
   */
  buildDocumentConfig(options) {
    const template = options.template ? this.templates[options.template] : this.templates.notes;
    const language = options.language || 'english';
    
    return {
      styles: {
        paragraphStyles: [
          {
            id: 'title',
            name: 'Title',
            basedOn: 'Normal',
            next: 'Normal',
            run: {
              size: 32,
              bold: true,
              font: this.languageFonts[language]
            },
            paragraph: {
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 }
            }
          },
          {
            id: 'heading',
            name: 'Heading',
            basedOn: 'Normal',
            next: 'Normal',
            run: {
              size: 28,
              bold: true,
              color: template.headerColor,
              font: this.languageFonts[language]
            },
            paragraph: {
              spacing: { before: 200, after: 200 }
            }
          },
          {
            id: 'normal',
            name: 'Normal',
            run: {
              size: this.defaultStyles.fontSize,
              font: this.languageFonts[language]
            },
            paragraph: {
              spacing: { line: this.defaultStyles.lineSpacing }
            }
          }
        ]
      },
      sections: []
    };
  }

  /**
   * Process content and create document sections
   * @private
   */
  async processContent(content, options) {
    try {
      let sections = [];

      if (typeof content === 'string') {
        // Simple text content
        sections = [this.createSimpleTextSection(content, options)];
      } else if (content && typeof content === 'object') {
        // Structured content
        sections = [this.createStructuredSection(content, options)];
      }

      return sections;

    } catch (error) {
      console.error('Content processing error:', error);
      throw new Error(`Content processing failed: ${error.message}`);
    }
  }

  /**
   * Create simple text section
   * @private
   */
  createSimpleTextSection(text, options) {
    const template = options.template ? this.templates[options.template] : this.templates.notes;
    
    return {
      properties: {
        page: {
          margin: this.defaultStyles.margins
        }
      },
      children: [
        // Title
        new Paragraph({
          text: options.title || template.title,
          style: 'title'
        }),
        
        // Content
        ...this.createTextParagraphs(text)
      ]
    };
  }

  /**
   * Create structured document section
   * @private
   */
  createStructuredSection(content, options) {
    const children = [];
    
    // Add title
    if (content.title) {
      children.push(new Paragraph({
        text: content.title,
        style: 'title'
      }));
    }

    // Add sections
    if (content.sections && Array.isArray(content.sections)) {
      content.sections.forEach(section => {
        // Add section heading
        if (section.heading) {
          children.push(new Paragraph({
            text: section.heading,
            style: 'heading'
          }));
        }

        // Add section content
        children.push(...this.createSectionContent(section));
      });
    }

    return {
      properties: {
        page: {
          margin: this.defaultStyles.margins
        }
      },
      children: children
    };
  }

  /**
   * Create section content based on type
   * @private
   */
  createSectionContent(section) {
    const paragraphs = [];

    switch (section.type) {
      case 'list':
        if (Array.isArray(section.content)) {
          section.content.forEach(item => {
            paragraphs.push(new Paragraph({
              children: [
                new TextRun({
                  text: `• ${item}`,
                  font: this.languageFonts.english
                })
              ]
            }));
          });
        }
        break;

      case 'metadata':
        if (Array.isArray(section.content)) {
          section.content.forEach(item => {
            paragraphs.push(new Paragraph({
              children: [
                new TextRun({
                  text: item,
                  italics: true,
                  font: this.languageFonts.english
                })
              ]
            }));
          });
        } else {
          paragraphs.push(new Paragraph({
            children: [
              new TextRun({
                text: section.content.toString(),
                italics: true
              })
            ]
          }));
        }
        break;

      case 'original':
        paragraphs.push(new Paragraph({
          children: [
            new TextRun({
              text: section.content,
              color: '666666',
              font: this.languageFonts.mixed
            })
          ]
        }));
        break;

      case 'corrected':
        paragraphs.push(new Paragraph({
          children: [
            new TextRun({
              text: section.content,
              color: '2E7D32',
              bold: true,
              font: this.languageFonts.mixed
            })
          ]
        }));
        break;

      case 'changes':
        if (Array.isArray(section.content)) {
          section.content.forEach((change, index) => {
            paragraphs.push(new Paragraph({
              children: [
                new TextRun({
                  text: `${index + 1}. ${change}`,
                  color: '1976D2',
                  font: this.languageFonts.english
                })
              ]
            }));
          });
        }
        break;

      default:
        paragraphs.push(...this.createTextParagraphs(section.content));
    }

    return paragraphs;
  }

  /**
   * Create text paragraphs from content
   * @private
   */
  createTextParagraphs(text) {
    if (!text) return [];
    
    const paragraphs = [];
    const lines = text.toString().split('\n');
    
    lines.forEach(line => {
      if (line.trim()) {
        paragraphs.push(new Paragraph({
          children: [
            new TextRun({
              text: line.trim(),
              font: this.languageFonts.mixed
            })
          ]
        }));
      } else {
        // Empty line for spacing
        paragraphs.push(new Paragraph({
          text: ''
        }));
      }
    });
    
    return paragraphs;
  }

  /**
   * Format grammar analysis data
   * @private
   */
  formatGrammarAnalysis(analysis) {
    if (!analysis) return 'No analysis available';
    
    const formatted = [];
    
    if (analysis.errors && analysis.errors.length > 0) {
      formatted.push('Grammar Errors Found:');
      analysis.errors.forEach((error, index) => {
        formatted.push(`${index + 1}. ${error.message || error}`);
      });
    }
    
    if (analysis.suggestions && analysis.suggestions.length > 0) {
      formatted.push('\nSuggestions:');
      analysis.suggestions.forEach((suggestion, index) => {
        formatted.push(`${index + 1}. ${suggestion}`);
      });
    }
    
    return formatted.join('\n');
  }

  /**
   * Format transcription with timestamps
   * @private
   */
  formatTranscriptionWithTimestamps(transcription) {
    if (!transcription || !Array.isArray(transcription)) {
      return 'No detailed transcription available';
    }
    
    return transcription.map(segment => {
      const startTime = this.formatTime(segment.start || 0);
      const endTime = this.formatTime(segment.end || segment.start || 0);
      return `[${startTime} - ${endTime}] ${segment.text || segment.word || ''}`;
    }).join('\n');
  }

  /**
   * Format word confidence details
   * @private
   */
  formatWordConfidenceDetails(words) {
    if (!words || !Array.isArray(words)) {
      return 'No word details available';
    }
    
    return words.map(word => {
      const confidence = ((word.confidence || 0) * 100).toFixed(1);
      return `${word.text || word.word || ''} (${confidence}%)`;
    }).join(', ');
  }

  /**
   * Format time in seconds to MM:SS format
   * @private
   */
  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Generate filename based on options
   * @private
   */
  generateFilename(options) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const template = options.template || 'document';
    const customName = options.filename || options.title || template;
    
    return `${customName.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.docx`;
  }

  /**
   * Export multiple documents as a batch
   * @param {Array} contentArray - Array of content objects to export
   * @param {Object} options - Batch export options
   * @returns {Promise<Array>} - Array of generated document results
   */
  async batchExport(contentArray, options = {}) {
    try {
      const results = [];
      
      for (const [index, content] of contentArray.entries()) {
        const itemOptions = {
          ...options,
          filename: `${options.filenamePrefix || 'batch'}_${index + 1}`,
          title: content.title || `Document ${index + 1}`
        };
        
        const result = await this.generateDocument(content, itemOptions);
        results.push(result);
      }
      
      return {
        success: true,
        totalDocuments: results.length,
        documents: results,
        totalSize: results.reduce((sum, doc) => sum + doc.size, 0)
      };
      
    } catch (error) {
      console.error('Batch export error:', error);
      throw new Error(`Batch export failed: ${error.message}`);
    }
  }

  /**
   * Get export statistics
   * @param {Array} exportResults - Array of export results
   * @returns {Object} - Export statistics
   */
  getExportStats(exportResults) {
    if (!Array.isArray(exportResults)) {
      return { error: 'Invalid export results' };
    }
    
    const successful = exportResults.filter(result => result.success);
    const failed = exportResults.filter(result => !result.success);
    const totalSize = successful.reduce((sum, result) => sum + (result.size || 0), 0);
    
    return {
      total: exportResults.length,
      successful: successful.length,
      failed: failed.length,
      successRate: ((successful.length / exportResults.length) * 100).toFixed(1),
      totalSize: totalSize,
      averageSize: successful.length > 0 ? Math.round(totalSize / successful.length) : 0
    };
  }
}

module.exports = DocExportService;