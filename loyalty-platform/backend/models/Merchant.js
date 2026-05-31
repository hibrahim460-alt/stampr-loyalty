const mongoose = require('mongoose');
const crypto = require('crypto');

const merchantSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    businessName: { type: String, required: true, trim: true },
    logoUrl: {
      type: String,
      default: 'https://placehold.co/200x200/1a1a1a/d4af37?text=Logo',
    },
    location: { type: String, default: '' },
    offerText: { type: String, default: 'Buy 9, Get the 10th Free' },
    stampsRequired: { type: Number, default: 10, min: 2 },
    // Unique join code that powers the join URL/QR redirect.
    joinCode: {
      type: String,
      unique: true,
      default: () => crypto.randomBytes(4).toString('hex').toUpperCase(),
    },
    // Static stamp code displayed at the counter (default stamping mechanism).
    stampCode: {
      type: String,
      unique: true,
      default: () => crypto.randomBytes(6).toString('hex').toUpperCase(),
    },
    birthdayClubEnabled: { type: Boolean, default: false },
    proFeaturesEnabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Merchant', merchantSchema);
