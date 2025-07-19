const mongoose = require('mongoose');

// Define the UserData schema
const userDataSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: false,
    trim: true
  },
  extractedText: {
    type: String,
    required: true,
    trim: true
  },
  correctedText: {
    type: String,
    required: true,
    trim: true
  },
  pronunciationScore: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
    validate: {
      validator: function(value) {
        return value >= 0 && value <= 100;
      },
      message: 'Pronunciation score must be between 0 and 100'
    }
  },
  language: {
    type: String,
    required: true,
    enum: {
      values: ['en', 'hi', 'pa'],
      message: 'Language must be one of: en (English), hi (Hindi), pa (Punjabi)'
    }
  },
  timestamp: {
    type: Date,
    default: Date.now,
    required: true
  }
}, {
  // Schema options
  timestamps: false, // We're using our own timestamp field
  versionKey: false  // Removes the __v field
});

// Add indexes for better query performance
userDataSchema.index({ userId: 1, timestamp: -1 });
userDataSchema.index({ language: 1, timestamp: -1 });
userDataSchema.index({ pronunciationScore: -1 });

// Add a virtual property to get formatted timestamp
userDataSchema.virtual('formattedTimestamp').get(function() {
  return this.timestamp.toISOString();
});

// Ensure virtual fields are serialized
userDataSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret._id;
    return ret;
  }
});

// Create and export the model
const UserData = mongoose.model('UserData', userDataSchema);

module.exports = UserData;