require('dotenv').config();
const app = require('./app');
const mongoose = require('mongoose');

// Configuration
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

// MongoDB connection options
const mongoOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 10, // Maximum number of connections in the connection pool
  serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
  socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
  bufferMaxEntries: 0, // Disable mongoose buffering
  bufferCommands: false, // Disable mongoose buffering
};

// Database connection
const connectDB = async () => {
  try {
    if (!MONGO_URI) {
      throw new Error('MONGO_URI environment variable is not defined');
    }

    console.log('🔄 Connecting to MongoDB Atlas...');
    
    const conn = await mongoose.connect(MONGO_URI, mongoOptions);
    
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);
    
    // Monitor connection events
    mongoose.connection.on('connected', () => {
      console.log('📡 Mongoose connected to MongoDB Atlas');
    });

    mongoose.connection.on('error', (err) => {
      console.error('❌ Mongoose connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('📴 Mongoose disconnected from MongoDB Atlas');
    });

    // Handle application termination
    process.on('SIGINT', async () => {
      console.log('\n🔄 Gracefully shutting down...');
      try {
        await mongoose.connection.close();
        console.log('📴 MongoDB connection closed');
        process.exit(0);
      } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
      }
    });

  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    
    // Exit with failure code in production, retry in development
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    } else {
      console.log('🔄 Retrying connection in 5 seconds...');
      setTimeout(connectDB, 5000);
    }
  }
};

// Start server
const startServer = async () => {
  try {
    // Connect to database first
    await connectDB();
    
    // Start HTTP server
    const server = app.listen(PORT, () => {
      console.log('\n🚀 EdTech Platform Server Started');
      console.log(`🌐 Server running on port: ${PORT}`);
      console.log(`🔗 Local URL: http://localhost:${PORT}`);
      console.log(`📚 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🌍 Supported Languages: Hindi (hi), Punjabi (pa), English (en)`);
      console.log('\n📋 Available API Endpoints:');
      console.log(`   • Health Check: http://localhost:${PORT}/health`);
      console.log(`   • OCR Service: http://localhost:${PORT}/api/ocr`);
      console.log(`   • Grammar Check: http://localhost:${PORT}/api/grammar`);
      console.log(`   • Speech Service: http://localhost:${PORT}/api/speech`);
      console.log(`   • Chat Service: http://localhost:${PORT}/api/chat`);
      console.log(`   • Export Service: http://localhost:${PORT}/api/export`);
      console.log('\n✨ Server is ready to accept requests!');
    });

    // Handle server errors
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
        console.log('💡 Try a different port or stop the existing process');
      } else {
        console.error('❌ Server error:', error);
      }
      process.exit(1);
    });

    // Graceful shutdown
    const gracefulShutdown = (signal) => {
      console.log(`\n🔄 Received ${signal}. Starting graceful shutdown...`);
      
      server.close(async (err) => {
        if (err) {
          console.error('❌ Error during server shutdown:', err);
          process.exit(1);
        }
        
        console.log('🛑 HTTP server closed');
        
        try {
          await mongoose.connection.close();
          console.log('📴 Database connection closed');
          console.log('✅ Graceful shutdown completed');
          process.exit(0);
        } catch (dbError) {
          console.error('❌ Error closing database connection:', dbError);
          process.exit(1);
        }
      });
    };

    // Listen for termination signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Handle uncaught exceptions and unhandled rejections
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  console.error('🛑 Shutting down due to uncaught exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  console.error('🛑 Shutting down due to unhandled promise rejection');
  process.exit(1);
});

// Start the server
startServer();