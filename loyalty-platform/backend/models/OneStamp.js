const mongoose = require('mongoose');
const crypto = require('crypto');

const oneStampSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      default: () => crypto.randomBytes(8).toString('hex').toUpperCase(),
    },
    merchant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Merchant',
      required: true,
    },
    isUsed: { type: Boolean, default: false },
    usedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('OneStamp', oneStampSchema);
