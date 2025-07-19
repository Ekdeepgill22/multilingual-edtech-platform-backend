# Multilingual EdTech Platform

A comprehensive Node.js + Express backend API for a multilingual educational technology platform supporting Hindi, Punjabi, and English. The platform provides OCR capabilities, speech-to-text conversion, grammar correction, AI-powered chat tutoring, and document export functionality.

## Features

- **Multilingual Support**: Hindi, Punjabi, and English
- **OCR (Optical Character Recognition)**: Extract text from images using Google Cloud Vision API
- **Speech-to-Text**: Convert audio to text using Google Cloud Speech-to-Text API
- **Grammar Correction**: AI-powered grammar checking and suggestions
- **Chat Tutoring**: Interactive AI tutoring using Gemini AI and Dialogflow
- **Document Export**: Generate and export content to .docx format
- **User Authentication**: JWT-based authentication system
- **File Upload**: Secure file upload with validation
- **Rate Limiting**: API rate limiting for security
- **Caching**: Redis-based caching for improved performance

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens)
- **AI/ML Services**: Google Gemini API, Dialogflow
- **Cloud Services**: Google Cloud Vision, Speech-to-Text, Translate
- **File Processing**: Multer, docx library
- **Caching**: Redis
- **Documentation**: Swagger/OpenAPI

## Prerequisites

Before you begin, ensure you have the following installed:

- [Node.js](https://nodejs.org/) (v16 or higher)
- [MongoDB](https://www.mongodb.com/) (v4.4 or higher)
- [Redis](https://redis.io/) (v6 or higher)
- [Google Cloud Platform Account](https://cloud.google.com/)

## Installation

1. **Clone the repository**
```bash
git clone https://github.com/Ekdeepgill22/multilingual-edtech-platform.git
cd multilingual-edtech-platform
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.example .env
```
Edit the `.env` file with your actual configuration values.

4. **Set up Google Cloud Services**
   - Create a Google Cloud Project
   - Enable the following APIs:
     - Cloud Vision API
     - Cloud Speech-to-Text API
     - Cloud Translate API
     - Dialogflow API
   - Create a service account and download the JSON key file
   - Set the `GOOGLE_APPLICATION_CREDENTIALS` path in your `.env` file

5. **Start MongoDB and Redis**
```bash
# Start MongoDB (if running locally)
mongod

# Start Redis (if running locally)
redis-server
```

6. **Run the application**
```bash
# Development mode with nodemon
npm run dev

# Production mode
npm start
```

The server will start on the port specified in your `.env` file (default: 3000).

## API Documentation

### Base URL
```
http://localhost:3000/api/v1
```

### Authentication

Most endpoints require authentication. Include the JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

### API Routes

#### 1. Authentication Routes

##### Register User
```http
POST /auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securePassword123",
  "preferredLanguage": "english"
}
```

##### Login User
```http
POST /auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "securePassword123"
}
```

##### Refresh Token
```http
POST /auth/refresh
Authorization: Bearer <refresh-token>
```

#### 2. OCR Routes

##### Extract Text from Image
```http
POST /ocr/extract
Authorization: Bearer <token>
Content-Type: multipart/form-data

Form Data:
- image: <image-file>
- language: "hindi" | "punjabi" | "english"
```

**cURL Example:**
```bash
curl -X POST \
  http://localhost:3000/api/v1/ocr/extract \
  -H 'Authorization: Bearer <your-token>' \
  -F 'image=@/path/to/your/image.jpg' \
  -F 'language=hindi'
```

#### 3. Speech-to-Text Routes

##### Convert Audio to Text
```http
POST /speech/convert
Authorization: Bearer <token>
Content-Type: multipart/form-data

Form Data:
- audio: <audio-file>
- language: "hi-IN" | "pa-IN" | "en-US"
```

**cURL Example:**
```bash
curl -X POST \
  http://localhost:3000/api/v1/speech/convert \
  -H 'Authorization: Bearer <your-token>' \
  -F 'audio=@/path/to/your/audio.wav' \
  -F 'language=hi-IN'
```

#### 4. Grammar Correction Routes

##### Check and Correct Grammar
```http
POST /grammar/check
Authorization: Bearer <token>
Content-Type: application/json

{
  "text": "This are a sample text with grammar mistake.",
  "language": "english"
}
```

**Response:**
```json
{
  "originalText": "This are a sample text with grammar mistake.",
  "correctedText": "This is a sample text with a grammar mistake.",
  "suggestions": [
    {
      "offset": 5,
      "length": 3,
      "message": "Subject-verb disagreement",
      "shortMessage": "Agreement error",
      "replacements": ["is"]
    }
  ]
}
```

#### 5. Chat Tutoring Routes

##### Start Chat Session
```http
POST /chat/session
Authorization: Bearer <token>
Content-Type: application/json

{
  "subject": "mathematics",
  "language": "hindi",
  "gradeLevel": "10"
}
```

##### Send Message to Tutor
```http
POST /chat/message
Authorization: Bearer <token>
Content-Type: application/json

{
  "sessionId": "session-id-here",
  "message": "Can you explain quadratic equations?",
  "language": "english"
}
```

##### Get Chat History
```http
GET /chat/history/:sessionId
Authorization: Bearer <token>
```

#### 6. Document Export Routes

##### Export Chat to DOCX
```http
POST /export/chat-to-docx
Authorization: Bearer <token>
Content-Type: application/json

{
  "sessionId": "session-id-here",
  "title": "Mathematics Tutoring Session",
  "language": "english"
}
```

##### Export Custom Content to DOCX
```http
POST /export/content-to-docx
Authorization: Bearer <token>
Content-Type: application/json

{
  "content": "Your content here...",
  "title": "Custom Document",
  "language": "hindi",
  "formatting": {
    "fontSize": 12,
    "fontFamily": "Arial",
    "alignment": "left"
  }
}
```

#### 7. Translation Routes

##### Translate Text
```http
POST /translate
Authorization: Bearer <token>
Content-Type: application/json

{
  "text": "Hello, how are you?",
  "from": "english",
  "to": "hindi"
}
```

#### 8. User Profile Routes

##### Get User Profile
```http
GET /user/profile
Authorization: Bearer <token>
```

##### Update User Profile
```http
PUT /user/profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Updated Name",
  "preferredLanguage": "punjabi"
}
```

### Error Responses

All endpoints return consistent error responses:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error information (in development mode)",
  "statusCode": 400
}
```

### Success Responses

All successful responses follow this format:

```json
{
  "success": true,
  "message": "Operation successful",
  "data": { /* response data */ },
  "statusCode": 200
}
```

## Language Codes

### Supported Languages

| Language | Code | Speech Code | Display Name |
|----------|------|-------------|--------------|
| English  | english | en-US | English |
| Hindi    | hindi | hi-IN | हिंदी |
| Punjabi  | punjabi | pa-IN | ਪੰਜਾਬੀ |

## Testing

### Run Tests
```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### API Testing with Postman

1. Import the Postman collection (if provided)
2. Set up environment variables:
   - `baseUrl`: `http://localhost:3000/api/v1`
   - `authToken`: Your JWT token after login

### Sample Test Data

You can use these sample requests for testing:

**Sample Image OCR Test:**
- Upload an image with Hindi, Punjabi, or English text
- Expected: Extracted text in the specified language

**Sample Audio Speech-to-Text Test:**
- Upload a WAV/MP3 file with clear speech
- Supported formats: WAV, FLAC, MP3
- Max file size: 10MB

## Deployment

### Environment Setup

1. **Production Environment Variables**
```bash
NODE_ENV=production
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/edtech_platform
```

2. **Docker Deployment**
```bash
# Build Docker image
docker build -t edtech-platform .

# Run with Docker Compose
docker-compose up -d
```

3. **Cloud Deployment (Heroku/AWS/GCP)**
   - Set environment variables in your cloud platform
   - Ensure Google Cloud credentials are properly configured
   - Set up MongoDB Atlas for database
   - Configure Redis for caching

### Performance Optimization

- Enable Redis caching for frequently accessed data
- Use MongoDB indexes for improved query performance
- Implement API rate limiting
- Use CDN for static assets
- Enable gzip compression

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and add tests
4. Commit your changes: `git commit -m 'Add feature'`
5. Push to the branch: `git push origin feature-name`
6. Submit a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support and questions:

- Create an issue in the GitHub repository
- Email: support@edtechplatform.com
- Documentation: https://docs.edtechplatform.com

## Changelog

### Version 1.0.0
- Initial release with core features
- Multilingual support for Hindi, Punjabi, English
- OCR, Speech-to-Text, Grammar correction
- Chat tutoring with AI
- Document export functionality

---

**Note**: Make sure to replace placeholder values in the `.env` file with your actual API keys and configuration before running the application.