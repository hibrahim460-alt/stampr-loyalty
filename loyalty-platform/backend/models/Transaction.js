const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    merchant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Merchant',
      required: true,
      index: true,
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: ['stamp', 'redeem', 'birthday_reward', 'join'],
      required: true,
      index: true,
    },
    // How a stamp was awarded, or how a reward was redeemed.
    detail: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Transaction', transactionSchema);
