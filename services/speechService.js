// services/speechService.js
const speech = require('@google-cloud/speech');
const fs = require('fs').promises;

class SpeechService {
  constructor() {
    // Initialize Google Cloud Speech client
    // Ensure GOOGLE_APPLICATION_CREDENTIALS environment variable is set
    // or pass keyFilename in client options
    this.speechClient = new speech.SpeechClient({
      // keyFilename: 'path/to/service-account-key.json', // Optional: if not using env var
    });

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
   * Transcribe audio file to text
   * @param {string|Buffer} audioInput - Audio file path or buffer
   * @param {Object} options - Transcription options
   * @returns {Promise<Object>} - Transcription result
   */
  async transcribeAudio(audioInput, options = {}) {
    try {
      let audioBytes;
      
      // Handle different input types
      if (typeof audioInput === 'string') {
        // File path
        audioBytes = await fs.readFile(audioInput);
      } else if (Buffer.isBuffer(audioInput)) {
        // Buffer
        audioBytes = audioInput;
      } else {
        throw new Error('Invalid audio input. Provide file path or buffer.');
      }

      const config = {
        ...this.defaultConfig,
        ...options
      };

      const audio = {
        content: audioBytes.toString('base64')
      };

      const request = {
        config: config,
        audio: audio
      };

      console.log('Starting audio transcription...');
      const [response] = await this.speechClient.recognize(request);
      
      const transcription = response.results
        .map(result => result.alternatives[0])
        .filter(alternative => alternative.transcript)
        .map(alternative => ({
          transcript: alternative.transcript,
          confidence: alternative.confidence,
          words: alternative.words?.map(word => ({
            word: word.word,
            startTime: word.startTime?.seconds || 0,
            endTime: word.endTime?.seconds || 0,
            confidence: word.confidence
          })) || []
        }));

      const detectedLanguage = this.detectLanguageFromTranscript(
        transcription.map(t => t.transcript).join(' ')
      );

      return {
        success: true,
        transcription: transcription,
        fullText: transcription.map(t => t.transcript).join(' '),
        detectedLanguage: detectedLanguage,
        totalDuration: this.calculateTotalDuration(transcription),
        wordCount: transcription.reduce((count, t) => count + t.words.length, 0)
      };

    } catch (error) {
      console.error('Speech transcription error:', error);
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
          confidence: alternative.confidence,
          words: alternative.words?.map(word => ({
            word: word.word,
            startTime: word.startTime?.seconds || 0,
            endTime: word.endTime?.seconds || 0,
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
      t.words.forEach(word => {
        if (word.endTime > maxEndTime) {
          maxEndTime = word.endTime;
        }
      });
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
      const supportedFormats = ['.wav', '.mp3', '.flac', '.webm', '.ogg'];
      if (!supportedFormats.includes(ext)) {
        throw new Error(`Unsupported audio format. Supported: ${supportedFormats.join(', ')}`);
      }
      
      return true;
    } catch (error) {
      throw new Error(`Audio validation failed: ${error.message}`);
    }
  }
}

module.exports = new SpeechService();