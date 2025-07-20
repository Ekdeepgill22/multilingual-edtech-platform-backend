// services/grammarService.js
const { GoogleGenerativeAI } = require('@google/generative-ai');

class GrammarService {
  constructor() {
    // Initialize Gemini AI client
    // Set GEMINI_API_KEY in environment variables
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'YOUR_GEMINI_API_KEY');
    this.model = this.genAI.getGenerativeModel({
      model: 'models/gemini-2.5-pro', // correct model name for v1
      generationConfig: {
        temperature: 0.7,
        topK: 1,
        topP: 1,
        maxOutputTokens: 2048,
      }
    });

    // Language-specific prompts
    this.prompts = {
      hindi: {
        grammar: `कृपया निम्नलिखित हिंदी पाठ में व्याकरण की त्रुटियों को ठीक करें और सुधारा हुआ पाठ प्रदान करें। मूल अर्थ को बनाए रखें।`,
        style: `इस हिंदी पाठ की शैली और स्पष्टता में सुधार करें।`
      },
      punjabi: {
        grammar: `ਕਿਰਪਾ ਕਰਕੇ ਇਸ ਪੰਜਾਬੀ ਟੈਕਸਟ ਵਿੱਚ ਵਿਆਕਰਣ ਦੀਆਂ ਗਲਤੀਆਂ ਨੂੰ ਸੁਧਾਰੋ ਅਤੇ ਸੁਧਾਰਿਆ ਹੋਇਆ ਟੈਕਸਟ ਪ੍ਰਦਾਨ ਕਰੋ। ਮੂਲ ਅਰਥ ਬਣਾਈ ਰੱਖੋ।`,
        style: `ਇਸ ਪੰਜਾਬੀ ਟੈਕਸਟ ਦੀ ਸ਼ੈਲੀ ਅਤੇ ਸਪਸ਼ਟਤਾ ਵਿੱਚ ਸੁਧਾਰ ਕਰੋ।`
      },
      english: {
        grammar: `Please correct the grammar errors in the following English text and provide the improved version. Maintain the original meaning.`,
        style: `Improve the style and clarity of this English text.`
      }
    };

    // Generation configuration
    this.generationConfig = {
      temperature: 0.3, // Lower temperature for more consistent corrections
      topK: 40,
      topP: 0.8,
      maxOutputTokens: 2048,
    };
  }

  /**
   * Correct grammar errors in text
   * @param {string} text - Input text to correct
   * @param {string} language - Language of the text (hindi/punjabi/english)
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} - Grammar correction result
   */
  async correctGrammar(text, language = 'english', options = {}) {
    try {
      if (!text || text.trim().length === 0) {
        throw new Error('Input text is required');
      }

      const normalizedLanguage = language.toLowerCase();
      if (!this.prompts[normalizedLanguage]) {
        throw new Error(`Unsupported language: ${language}. Supported: hindi, punjabi, english`);
      }

      const prompt = this.buildGrammarPrompt(text, normalizedLanguage, options);

      console.log(`Correcting grammar for ${language} text...`);

      const result = await this.model.generateContent([{ text: prompt }]);

      const response = await result.response;
      const correctedText = response.text();

      console.log("🔍 Gemini Raw Output:\n", response);

      // Parse the structured response
      const parsedResult = this.parseGrammarResponse(correctedText, text);

      return {
        success: true,
        original: text,
        corrected: parsedResult.corrected,
        changes: parsedResult.changes,
        language: normalizedLanguage,
        confidence: this.calculateConfidence(text, parsedResult.corrected),
        suggestions: parsedResult.suggestions || []
      };

    } catch (error) {
      console.error('Grammar correction error:', error);
      throw new Error(`Grammar correction failed: ${error.message}`);
    }
  }

  /**
   * Improve text style and clarity
   * @param {string} text - Input text to improve
   * @param {string} language - Language of the text
   * @param {Object} options - Style improvement options
   * @returns {Promise<Object>} - Style improvement result
   */
  async improveStyle(text, language = 'english', options = {}) {
    try {
      if (!text || text.trim().length === 0) {
        throw new Error('Input text is required');
      }

      const normalizedLanguage = language.toLowerCase();
      const prompt = this.buildStylePrompt(text, normalizedLanguage, options);

      console.log(`Improving style for ${language} text...`);

      const result = await this.model.generateContent([{ text: prompt }]);

      const response = await result.response;
      const improvedText = response.text();

      return {
        success: true,
        original: text,
        improved: improvedText.trim(),
        language: normalizedLanguage,
        improvements: this.identifyImprovements(text, improvedText)
      };

    } catch (error) {
      console.error('Style improvement error:', error);
      throw new Error(`Style improvement failed: ${error.message}`);
    }
  }

  /**
   * Comprehensive text analysis and correction
   * @param {string} text - Input text
   * @param {string} language - Language of the text
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} - Comprehensive analysis result
   */
  async analyzeAndCorrect(text, language = 'english', options = {}) {
    try {
      const [grammarResult, styleResult] = await Promise.all([
        this.correctGrammar(text, language, options),
        this.improveStyle(text, language, options)
      ]);

      return {
        success: true,
        original: text,
        grammar: grammarResult,
        style: styleResult,
        language: language,
        recommendations: this.generateRecommendations(grammarResult, styleResult)
      };

    } catch (error) {
      console.error('Comprehensive analysis error:', error);
      throw new Error(`Text analysis failed: ${error.message}`);
    }
  }

  /**
   * Detect and correct mixed language text
   * @param {string} text - Mixed language text
   * @param {Array} languages - Expected languages in the text
   * @returns {Promise<Object>} - Mixed language correction result
   */
  async correctMixedLanguageText(text, languages = ['english', 'hindi']) {
    try {
      const languageList = languages.join(', ');
      const prompt = `
        The following text contains mixed languages (${languageList}). 
        Please correct grammar and improve clarity while maintaining the multilingual nature.
        Provide the corrected text and identify which parts are in which languages.
        
        Text: "${text}"
        
        Please respond in this format:
        CORRECTED TEXT: [corrected version]
        LANGUAGE SEGMENTS: [identify language of each part]
        CHANGES MADE: [list of corrections]
      `;

      const result = await this.model.generateContent([{ text: prompt }]);

      const response = await result.response;
      const responseText = response.text();

      return {
        success: true,
        original: text,
        corrected: this.extractCorrectedText(responseText),
        languageSegments: this.extractLanguageSegments(responseText),
        changes: this.extractChanges(responseText),
        detectedLanguages: languages
      };

    } catch (error) {
      console.error('Mixed language correction error:', error);
      throw new Error(`Mixed language correction failed: ${error.message}`);
    }
  }

  /**
   * Build grammar correction prompt
   * @private
   */
  buildGrammarPrompt(text, language, options) {
    const basePrompt = this.prompts[language].grammar;
    const contextPrompt = options.context ? `Context: ${options.context}\n` : '';
    const formatInstructions = `
⚠️ Respond in this strict format:
CORRECTED: [only the corrected version here, do not add extra text]
CHANGES: [list each grammar or word change clearly, one per line]
SUGGESTIONS: [formal alternatives, writing tips, or enhancements]
`;

    return `${contextPrompt}${basePrompt}\n\nText: "${text}"\n${formatInstructions}`;
  }

  /**
   * Build style improvement prompt
   * @private
   */
  buildStylePrompt(text, language, options) {
    const basePrompt = this.prompts[language].style;
    const styleType = options.styleType || 'general';
    const audiencePrompt = options.audience ? `Target audience: ${options.audience}\n` : '';

    return `${audiencePrompt}${basePrompt}\nStyle focus: ${styleType}\n\nText: "${text}"`;
  }

  /**
   * Parse structured grammar response
   * @private
   */
  parseGrammarResponse(response, originalText) {
    const correctedMatch = response.match(/CORRECTED:\s*(.*?)(?=\n[A-Z]+:|$)/s);
    const changesMatch = response.match(/CHANGES:\s*(.*?)(?=\n[A-Z]+:|$)/s);
    const suggestionsMatch = response.match(/SUGGESTIONS:\s*(.*)/s);

    const fallbackTrim = response.replace(/^(CORRECTED:|CHANGES:|SUGGESTIONS:)/gm, '').trim();

    return {
      corrected: correctedMatch?.[1]?.trim() || fallbackTrim,
      changes: changesMatch ? changesMatch[1].trim().split('\n').filter(c => c.trim()) : [],
      suggestions: suggestionsMatch ? suggestionsMatch[1].trim().split('\n').filter(s => s.trim()) : []
    };
  }

  /**
   * Calculate confidence score for corrections
   * @private
   */
  calculateConfidence(original, corrected) {
    const similarity = this.calculateSimilarity(original, corrected);
    const lengthDifference = Math.abs(original.length - corrected.length) / Math.max(original.length, corrected.length);

    // Higher similarity and lower length difference = higher confidence
    return Math.max(0, Math.min(1, similarity - lengthDifference * 0.5));
  }

  /**
   * Calculate text similarity (simple implementation)
   * @private
   */
  calculateSimilarity(text1, text2) {
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);
    const intersection = words1.filter(word => words2.includes(word));

    return intersection.length / Math.max(words1.length, words2.length);
  }

  /**
   * Identify improvements made to text
   * @private
   */
  identifyImprovements(original, improved) {
    return {
      lengthChange: improved.length - original.length,
      wordCountChange: improved.split(/\s+/).length - original.split(/\s+/).length,
      structuralChanges: this.identifyStructuralChanges(original, improved)
    };
  }

  /**
   * Generate recommendations based on analysis
   * @private
   */
  generateRecommendations(grammarResult, styleResult) {
    const recommendations = [];

    if (grammarResult.changes.length > 3) {
      recommendations.push('Consider reviewing basic grammar rules for better accuracy');
    }

    if (grammarResult.confidence < 0.7) {
      recommendations.push('Text may need human review for complex grammar issues');
    }

    if (styleResult.improvements.wordCountChange > 20) {
      recommendations.push('Text structure was significantly improved - consider using similar patterns');
    }

    return recommendations;
  }

  /**
   * Extract sections from mixed language response
   * @private
   */
  extractCorrectedText(response) {
    const match = response.match(/CORRECTED TEXT:\s*(.*?)(?=LANGUAGE SEGMENTS:|$)/s);
    return match ? match[1].trim() : response;
  }

  extractLanguageSegments(response) {
    const match = response.match(/LANGUAGE SEGMENTS:\s*(.*?)(?=CHANGES MADE:|$)/s);
    return match ? match[1].trim() : '';
  }

  extractChanges(response) {
    const match = response.match(/CHANGES MADE:\s*(.*)/s);
    return match ? match[1].trim().split('\n').filter(c => c.trim()) : [];
  }

  /**
   * Simple structural change detection
   * @private
   */
  identifyStructuralChanges(original, improved) {
    return {
      sentenceCountChange: improved.split('.').length - original.split('.').length,
      paragraphCountChange: improved.split('\n\n').length - original.split('\n\n').length
    };
  }
}

module.exports = new GrammarService();