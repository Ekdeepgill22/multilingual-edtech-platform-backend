// services/speechService.js
const speech = require('@google-cloud/speech');
const fs = require('fs').promises;

class SpeechService {
  constructor() {
    // Initialize Google Cloud Speech client
    // Check if we have API key or service account credentials
    let clientConfig = {};
    
    if (process.env.GOOGLE_CLOUD_API_KEY) {
      // Using API Key (simpler setup)
      clientConfig = {
        apiKey: process.env.GOOGLE_CLOUD_API_KEY,
        projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || 'your-project-id'
      };
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      // Using Service Account JSON file path
      clientConfig = {
        keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
      };
    } else if (process.env.GOOGLE_CLOUD_CREDENTIALS) {
      // Using Service Account JSON content as string
      try {
        const credentials = JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS);
        clientConfig = {
          credentials: credentials,
          projectId: credentials.project_id
        };
      } catch (error) {
        console.error('Invalid GOOGLE_CLOUD_CREDENTIALS JSON:', error);
        throw new Error('Invalid Google Cloud credentials format');
      }
    } else {
      throw new Error('Google Cloud credentials not found. Please set GOOGLE_CLOUD_API_KEY, GOOGLE_APPLICATION_CREDENTIALS, or GOOGLE_CLOUD_CREDENTIALS environment variable');
    }

    console.log('Initializing Google Cloud Speech client with config:', {
      hasApiKey: !!clientConfig.apiKey,
      hasKeyFilename: !!clientConfig.keyFilename,
      hasCredentials: !!clientConfig.credentials,
      projectId: clientConfig.projectId
    });

    this.speechClient = new speech.SpeechClient(clientConfig);

    // Language codes for Hindi, Punjabi, and English
    this.languageCodes = {
      hindi: 'hi-IN',
      punjabi: 'pa-IN',
      english: 'en-IN'
    };

    // Default configuration
    this.defaultConfig = {
      encoding: 'WEBM_OPUS', // Common web format
      sampleRateHertz: 48000,
      languageCode: 'en-IN',
      alternativeLanguageCodes: ['hi-IN', 'pa-IN'],
      enableAutomaticPunctuation: true,
      enableWordTimeOffsets: true,
      useEnhanced: true,
      model: 'latest_long'
    };
  }

  /**
   * Determine audio encoding from buffer/mime type
   * @param {Buffer} audioBuffer - Audio buffer
   * @param {string} mimeType - MIME type of audio
   * @returns {string} - Google Cloud Speech encoding
   */
  determineEncoding(audioBuffer, mimeType) {
    if (mimeType) {
      if (mimeType.includes('wav')) return 'LINEAR16';
      if (mimeType.includes('mp3') || mimeType.includes('mpeg')) return 'MP3';
      if (mimeType.includes('webm')) return 'WEBM_OPUS';
      if (mimeType.includes('ogg')) return 'OGG_OPUS';
      if (mimeType.includes('m4a') || mimeType.includes('mp4')) return 'MP3';
    }
    
    // Fallback: try to detect from buffer header
    if (audioBuffer) {
      const header = audioBuffer.slice(0, 4).toString('hex');
      if (header === '52494646') return 'LINEAR16'; // RIFF (WAV)
      if (header.startsWith('494433') || header.startsWith('fff')) return 'MP3'; // ID3 or MP3 sync
    }
    
    return 'WEBM_OPUS'; // Default fallback
  }

  /**
   * Transcribe audio file to text
   * @param {string|Buffer} audioInput - Audio file path or buffer
   * @param {Object} options - Transcription options
   * @returns {Promise<Object>} - Transcription result
   */
  async transcribeAudio(audioInput, options = {}) {
    try {
      let audioBytes;
      let encoding = this.defaultConfig.encoding;

      // Handle different input types
      if (typeof audioInput === 'string') {
        // File path
        audioBytes = await fs.readFile(audioInput);
      } else if (Buffer.isBuffer(audioInput)) {
        // Buffer
        audioBytes = audioInput;
        // Try to determine encoding from options or buffer
        encoding = this.determineEncoding(audioBytes, options.mimeType);
      } else {
        throw new Error('Invalid audio input. Provide file path or buffer.');
      }

      // Validate audio size
      if (audioBytes.length === 0) {
        throw new Error('Audio file is empty');
      }

      if (audioBytes.length > 10 * 1024 * 1024) {
        throw new Error('Audio file too large for direct transcription. Maximum size: 10MB');
      }

      const config = {
        ...this.defaultConfig,
        encoding: encoding,
        ...options
      };

      const audio = {
        content: audioBytes.toString('base64')
      };

      const request = {
        config: config,
        audio: audio
      };

      console.log('Starting audio transcription with config:', {
        encoding: config.encoding,
        languageCode: config.languageCode,
        sampleRateHertz: config.sampleRateHertz
      });

      const [response] = await this.speechClient.recognize(request);

      if (!response.results || response.results.length === 0) {
        return {
          success: true,
          transcription: [],
          fullText: '',
          detectedLanguage: 'unknown',
          totalDuration: 0,
          wordCount: 0,
          message: 'No speech detected in audio'
        };
      }

      const transcription = response.results
        .map(result => result.alternatives[0])
        .filter(alternative => alternative && alternative.transcript)
        .map(alternative => ({
          transcript: alternative.transcript,
          confidence: alternative.confidence ?? null,
          words: alternative.words?.map(word => ({
            word: word.word,
            startTime: (word.startTime?.seconds || 0) + (word.startTime?.nanos || 0) / 1e9,
            endTime: (word.endTime?.seconds || 0) + (word.endTime?.nanos || 0) / 1e9,
            confidence: word.confidence ?? null
          })) || []
        }));

      const fullText = transcription.map(t => t.transcript).join(' ').trim();
      const detectedLanguage = this.detectLanguageFromTranscript(fullText);

      return {
        success: true,
        transcription: transcription,
        fullText: fullText,
        detectedLanguage: detectedLanguage,
        totalDuration: this.calculateTotalDuration(transcription),
        wordCount: transcription.reduce((count, t) => count + t.words.length, 0),
        processingTime: Date.now()
      };

    } catch (error) {
      console.error('Speech transcription error:', error);
      
      // Handle specific Google Cloud Speech errors
      if (error.code === 3) {
        throw new Error('Invalid audio format or corrupted audio file');
      }
      if (error.code === 11) {
        throw new Error('Audio file is too large or too long');
      }
      if (error.code === 8) {
        throw new Error('Audio processing quota exceeded');
      }
      if (error.message.includes('Empty audio data')) {
        throw new Error('no speech detected');
      }
      
      throw new Error(`Audio transcription failed: ${error.message}`);
    }
  }

  /**
   * Transcribe long audio file using long-running operation
   * @param {string} gcsUri - Google Cloud Storage URI of audio file
   * @param {Object} options - Transcription options
   * @returns {Promise<Object>} - Transcription result
   */
  async transcribeLongAudio(gcsUri, options = {}) {
    try {
      const config = {
        ...this.defaultConfig,
        ...options
      };

      const audio = {
        uri: gcsUri
      };

      const request = {
        config: config,
        audio: audio
      };

      console.log('Starting long audio transcription...');
      const [operation] = await this.speechClient.longRunningRecognize(request);

      // Wait for operation to complete
      const [response] = await operation.promise();

      const transcription = response.results
        .map(result => result.alternatives[0])
        .filter(alternative => alternative.transcript)
        .map(alternative => ({
          transcript: alternative.transcript,
          confidence: alternative.confidence ?? null,
          words: alternative.words?.map(word => ({
            word: word.word,
            startTime: (word.startTime?.seconds || 0) + (word.startTime?.nanos || 0) / 1e9,
            endTime: (word.endTime?.seconds || 0) + (word.endTime?.nanos || 0) / 1e9,
            confidence: word.confidence
          })) || []
        }));

      return {
        success: true,
        transcription: transcription,
        fullText: transcription.map(t => t.transcript).join(' '),
        operationId: operation.name,
        processingTime: 'Long-running operation completed'
      };

    } catch (error) {
      console.error('Long audio transcription error:', error);
      throw new Error(`Long audio transcription failed: ${error.message}`);
    }
  }

  /**
   * Stream audio transcription (for real-time transcription)
   * @param {ReadableStream} audioStream - Audio stream
   * @param {Object} options - Stream options
   * @returns {Promise<Object>} - Stream transcription setup
   */
  async streamTranscription(audioStream, options = {}) {
    try {
      const config = {
        ...this.defaultConfig,
        ...options
      };

      const request = {
        config: config,
        interimResults: true,
        singleUtterance: false
      };

      const recognizeStream = this.speechClient
        .streamingRecognize(request)
        .on('data', (data) => {
          if (data.results[0] && data.results[0].alternatives[0]) {
            const transcript = data.results[0].alternatives[0].transcript;
            const confidence = data.results[0].alternatives[0].confidence;
            const isFinal = data.results[0].isFinal;

            // Emit transcription events
            options.onTranscript && options.onTranscript({
              transcript,
              confidence,
              isFinal
            });
          }
        })
        .on('error', (error) => {
          console.error('Stream transcription error:', error);
          options.onError && options.onError(error);
        })
        .on('end', () => {
          console.log('Stream transcription ended');
          options.onEnd && options.onEnd();
        });

      // Pipe audio stream to recognition stream
      audioStream.pipe(recognizeStream);

      return {
        success: true,
        stream: recognizeStream,
        message: 'Streaming transcription started'
      };

    } catch (error) {
      console.error('Stream setup error:', error);
      throw new Error(`Stream transcription setup failed: ${error.message}`);
    }
  }

  /**
   * Generate pronunciation practice exercises
   * @param {Object} options - Exercise generation options
   * @returns {Promise<Object>} - Generated exercises
   */
  async generatePracticeExercises(options = {}) {
    const { 
      language = 'en', 
      difficulty = 'intermediate',
      focusAreas = [],
      exerciseCount = 5 
    } = options;

    // Sample exercises - in a real implementation, this would come from a database or AI service
    const exerciseTemplates = {
      en: {
        beginner: [
          { text: "Hello, how are you?", focus: "basic_greeting", phonetic: "/həˈloʊ haʊ ɑr ju/" },
          { text: "Thank you very much", focus: "politeness", phonetic: "/θæŋk ju ˈvɛri mʌtʃ/" },
          { text: "What is your name?", focus: "questions", phonetic: "/wʌt ɪz jʊr neɪm/" }
        ],
        intermediate: [
          { text: "I would like to make a reservation", focus: "formal_speech", phonetic: "/aɪ wʊd laɪk tu meɪk ə ˌrɛzərˈveɪʃən/" },
          { text: "Could you please help me with this?", focus: "requests", phonetic: "/kʊd ju pliz hɛlp mi wɪð ðɪs/" },
          { text: "The weather is beautiful today", focus: "descriptive", phonetic: "/ðə ˈwɛðər ɪz ˈbjutəfəl təˈdeɪ/" }
        ],
        advanced: [
          { text: "I appreciate your understanding in this matter", focus: "professional", phonetic: "/aɪ əˈpriʃiˌeɪt jʊr ˌʌndərˈstændɪŋ ɪn ðɪs ˈmætər/" },
          { text: "The implementation of this strategy requires careful consideration", focus: "complex_vocabulary", phonetic: "/ðə ˌɪmpləmənˈteɪʃən ʌv ðɪs ˈstrætədʒi rɪˈkwaɪərz ˈkɛrfəl kənˌsɪdəˈreɪʃən/" }
        ]
      },
      hi: {
        beginner: [
          { text: "नमस्ते, आप कैसे हैं?", focus: "basic_greeting", phonetic: "/nəməste aːp kɛːse hɛ̃/" },
          { text: "धन्यवाद", focus: "politeness", phonetic: "/d̪ʰənjəʋaːd̪/" },
          { text: "आपका नाम क्या है?", focus: "questions", phonetic: "/aːpkaː naːm kjaː hɛ/" }
        ],
        intermediate: [
          { text: "मुझे एक टिकट चाहिए", focus: "requests", phonetic: "/mud͡ʒʰe ek ʈɪkəʈ t͡ʃaːhɪe/" },
          { text: "आज मौसम बहुत अच्छा है", focus: "descriptive", phonetic: "/aːd͡ʒ mɔːsəm bəhut̪ ət͡ʃʰt͡ʃʰaː hɛ/" }
        ]
      },
      pa: {
        beginner: [
          { text: "ਸਤ ਸ੍ਰੀ ਅਕਾਲ", focus: "basic_greeting", phonetic: "/sət̪ sɾiː əkaːl/" },
          { text: "ਤੁਹਾਡਾ ਨਾਮ ਕੀ ਹੈ?", focus: "questions", phonetic: "/t̪ʊhaːɖaː naːm kiː hɛ/" },
          { text: "ਧਨਵਾਦ", focus: "politeness", phonetic: "/d̪ʰənʋaːd̪/" }
        ],
        intermediate: [
          { text: "ਮੈਨੂੰ ਮਦਦ ਚਾਹੀਦੀ ਹੈ", focus: "requests", phonetic: "/mɛnũː məd̪d̪ t͡ʃaːhiːd̪iː hɛ/" },
          { text: "ਅੱਜ ਮੌਸਮ ਬਹੁਤ ਚੰਗਾ ਹੈ", focus: "descriptive", phonetic: "/əd͡ʒ mɔːsəm bəhʊt̪ t͡ʃəŋɡaː hɛ/" }
        ]
      }
    };

    const templates = exerciseTemplates[language] || exerciseTemplates['en'];
    const difficultyTemplates = templates[difficulty] || templates['intermediate'];
    
    // Filter by focus areas if specified
    let selectedExercises = difficultyTemplates;
    if (focusAreas.length > 0) {
      selectedExercises = difficultyTemplates.filter(ex => 
        focusAreas.includes(ex.focus)
      );
    }

    // Select random exercises up to exerciseCount
    const exercises = selectedExercises
      .sort(() => Math.random() - 0.5)
      .slice(0, exerciseCount)
      .map((exercise, index) => ({
        id: index + 1,
        text: exercise.text,
        phonetic: exercise.phonetic,
        focus: exercise.focus,
        difficulty: difficulty,
        language: language,
        tips: this.getExerciseTips(exercise.focus, language)
      }));

    return {
      exercises: exercises,
      instructions: this.getInstructions(language, difficulty),
      tips: this.getGeneralTips(language)
    };
  }

  /**
   * Get exercise-specific tips
   * @param {string} focus - Focus area
   * @param {string} language - Language code
   * @returns {Array} - Tips array
   */
  getExerciseTips(focus, language) {
    const tips = {
      basic_greeting: ["Focus on clear vowel sounds", "Pay attention to intonation"],
      politeness: ["Emphasize the 'th' sounds", "Use rising intonation for politeness"],
      questions: ["End with rising intonation", "Stress the question word"],
      requests: ["Use polite intonation", "Speak slowly and clearly"],
      descriptive: ["Emphasize adjectives", "Use natural rhythm"],
      formal_speech: ["Speak slowly", "Enunciate each syllable clearly"],
      professional: ["Maintain formal tone", "Pause between clauses"],
      complex_vocabulary: ["Break down long words", "Practice syllable stress"]
    };
    
    return tips[focus] || ["Practice slowly", "Focus on clear pronunciation"];
  }

  /**
   * Get general instructions
   * @param {string} language - Language code
   * @param {string} difficulty - Difficulty level
   * @returns {string} - Instructions
   */
  getInstructions(language, difficulty) {
    const instructions = {
      en: {
        beginner: "Read each sentence slowly and clearly. Focus on basic pronunciation and rhythm.",
        intermediate: "Practice natural intonation and stress patterns. Record yourself and compare.",
        advanced: "Focus on fluency, natural rhythm, and professional delivery."
      },
      hi: {
        beginner: "प्रत्येक वाक्य को धीरे और स्पष्ट रूप से पढ़ें।",
        intermediate: "प्राकृतिक स्वर और तनाव पैटर्न का अभ्यास करें।",
        advanced: "प्रवाहता और व्यावसायिक सुपुर्दगी पर ध्यान दें।"
      },
      pa: {
        beginner: "ਹਰ ਵਾਕ ਨੂੰ ਹੌਲੀ ਅਤੇ ਸਾਫ਼ ਪੜ੍ਹੋ।",
        intermediate: "ਕੁਦਰਤੀ ਸੁਰ ਅਤੇ ਤਣਾਅ ਦਾ ਅਭਿਆਸ ਕਰੋ।",
        advanced: "ਪ੍ਰਵਾਹ ਅਤੇ ਪੇਸ਼ੇਵਰ ਸੁਪੁਰਦਗੀ 'ਤੇ ਧਿਆਨ ਦਿਓ।"
      }
    };

    return instructions[language]?.[difficulty] || instructions['en'][difficulty];
  }

  /**
   * Get general tips
   * @param {string} language - Language code
   * @returns {Array} - General tips
   */
  getGeneralTips(language) {
    const tips = {
      en: [
        "Record yourself and listen back",
        "Practice in front of a mirror",
        "Focus on mouth movements",
        "Use a pronunciation dictionary",
        "Practice with native speakers"
      ],
      hi: [
        "अपनी आवाज़ रिकॉर्ड करें और सुनें",
        "आईने के सामने अभ्यास करें",
        "मुंह की गतिविधियों पर ध्यान दें"
      ],
      pa: [
        "ਆਪਣੀ ਆਵਾਜ਼ ਰਿਕਾਰਡ ਕਰੋ ਅਤੇ ਸੁਣੋ",
        "ਸ਼ੀਸ਼ੇ ਦੇ ਸਾਮ੍ਹਣੇ ਅਭਿਆਸ ਕਰੋ"
      ]
    };

    return tips[language] || tips['en'];
  }

  /**
   * Get user pronunciation history (mock implementation)
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} - User history
   */
  async getUserPronunciationHistory(userId, options = {}) {
    // Mock implementation - in real app, this would query a database
    return {
      history: [],
      pagination: {
        page: options.page || 1,
        limit: options.limit || 10,
        total: 0,
        totalPages: 0
      },
      filters: {
        language: options.language,
        evaluationType: options.evaluationType
      }
    };
  }

  /**
   * Get user pronunciation statistics (mock implementation)
   * @param {string} userId - User ID
   * @param {string} timeRange - Time range
   * @param {string} language - Language filter
   * @returns {Promise<Object>} - User statistics
   */
  async getUserPronunciationStats(userId, timeRange, language) {
    // Mock implementation - in real app, this would query a database
    return {
      averageScore: 0,
      totalSessions: 0,
      improvementTrend: [],
      weakAreas: [],
      strongAreas: [],
      timeRange: timeRange,
      language: language
    };
  }

  /**
   * Delete pronunciation record (mock implementation)
   * @param {string} recordId - Record ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} - Deletion success
   */
  async deletePronunciationRecord(recordId, userId) {
    // Mock implementation - in real app, this would delete from database
    return true;
  }

  /**
   * Get supported languages and their codes
   * @returns {Object} - Language codes mapping
   */
  getSupportedLanguages() {
    return {
      ...this.languageCodes,
      supported: Object.keys(this.languageCodes),
      default: 'english'
    };
  }

  /**
   * Detect language from transcript content
   * @param {string} transcript - Transcribed text
   * @returns {string} - Detected language
   */
  detectLanguageFromTranscript(transcript) {
    if (!transcript || transcript.trim().length === 0) {
      return 'unknown';
    }

    // Simple language detection based on character patterns
    const hindiPattern = /[\u0900-\u097F]/;
    const punjabiPattern = /[\u0A00-\u0A7F]/;

    if (hindiPattern.test(transcript)) return 'hindi';
    if (punjabiPattern.test(transcript)) return 'punjabi';
    return 'english';
  }

  /**
   * Calculate total duration from word timestamps
   * @param {Array} transcription - Transcription with word timestamps
   * @returns {number} - Total duration in seconds
   */
  calculateTotalDuration(transcription) {
    let maxEndTime = 0;
    transcription.forEach(t => {
      if (t.words && t.words.length > 0) {
        t.words.forEach(word => {
          if (word.endTime && word.endTime > maxEndTime) {
            maxEndTime = word.endTime;
          }
        });
      }
    });
    return maxEndTime;
  }

  /**
   * Validate audio file format and size
   * @param {string} filePath - Audio file path
   * @returns {Promise<boolean>} - Validation result
   */
  async validateAudioFile(filePath) {
    try {
      const path = require('path');
      const stats = await fs.stat(filePath);

      // Check file size (max 100MB for regular transcription)
      if (stats.size > 100 * 1024 * 1024) {
        throw new Error('Audio file too large. Use GCS URI for files over 100MB.');
      }

      // Check supported formats
      const ext = path.extname(filePath).toLowerCase();
      const supportedFormats = ['.wav', '.mp3', '.flac', '.webm', '.ogg', '.m4a'];
      if (!supportedFormats.includes(ext)) {
        throw new Error(`Unsupported audio format. Supported: ${supportedFormats.join(', ')}`);
      }

      return true;
    } catch (error) {
      throw new Error(`Audio validation failed: ${error.message}`);
    }
  }
  
  /**
   * Save transcript to file
   * @param {Object} transcriptObj - Transcript object
   * @param {string} outputPath - Output file path
   * @returns {Promise<void>}
   */
  async saveTranscriptToFile(transcriptObj, outputPath) {
    try {
      await fs.writeFile(outputPath, JSON.stringify(transcriptObj, null, 2));
      console.log(`Transcript saved to: ${outputPath}`);
    } catch (error) {
      throw new Error(`Failed to save transcript: ${error.message}`);
    }
  }
}

module.exports = new SpeechService();