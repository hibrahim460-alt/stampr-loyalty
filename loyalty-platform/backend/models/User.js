const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['member', 'merchant'],
    default: 'member'
  },
  
  // ========================================================
  // EMAIL VERIFICATION TRACKING FIELDS
  // ========================================================
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationCode: {
    type: String,
    default: undefined
  },
  verificationExpires: {
    type: Date,
    default: undefined
  }
}, { 
  timestamps: true // Automatically creates 'createdAt' and 'updatedAt' fields
});

module.exports = mongoose.model('User', UserSchema);
