const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please use a valid email address.'],
    },
    password: { type: String, required: true, minlength: 6, select: false },
    role: {
      type: String,
      enum: ['member', 'merchant', 'admin'],
      default: 'member',
    },
    birthday: { type: Date, default: null },
    // For merchant accounts, links to the Merchant business profile they own.
    merchantProfile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Merchant',
      default: null,
    },
    lastBirthdayRewardYear: { type: Number, default: null },
  },
  { timestamps: true }
);

// Hash password before save (only when modified).
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function (entered) {
  return bcrypt.compare(entered, this.password);
};

module.exports = mongoose.model('User', userSchema);
