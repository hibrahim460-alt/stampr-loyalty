const mongoose = require('mongoose');

const stampEventSchema = new mongoose.Schema(
  {
    method: { type: String, enum: ['stampCode', 'oneStamp', 'manual'], required: true },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const rewardSchema = new mongoose.Schema({
  code: { type: String, required: true },
  earnedAt: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ['available', 'redeeming', 'redeemed', 'expired'],
    default: 'available',
  },
  // Set when the member taps "Redeem" — drives the 3-minute in-person timer.
  redeemStartedAt: { type: Date, default: null },
  redeemedAt: { type: Date, default: null },
  source: { type: String, enum: ['card', 'birthday'], default: 'card' },
});

const stampCardSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    merchant: { type: mongoose.Schema.Types.ObjectId, ref: 'Merchant', required: true },
    currentStampsCount: { type: Number, default: 0, min: 0 },
    totalStampsEarned: { type: Number, default: 0 },
    history: [stampEventSchema],
    rewards: [rewardSchema],
  },
  { timestamps: true }
);

// One card per user per merchant.
stampCardSchema.index({ user: 1, merchant: 1 }, { unique: true });

module.exports = mongoose.model('StampCard', stampCardSchema);
