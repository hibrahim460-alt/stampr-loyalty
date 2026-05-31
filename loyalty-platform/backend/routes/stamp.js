const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Merchant = require('../models/Merchant');
const StampCard = require('../models/StampCard');
const OneStamp = require('../models/OneStamp');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');
const { generateRewardCode, sendNotification } = require('../utils');

// Internal helper: apply one stamp to a member's card for a merchant.
// Handles card creation, $inc increment, reward generation on completion,
// and transaction logging. Returns the updated card.
async function applyStamp({ userId, merchant, method }) {
  // Ensure a card exists (upsert) then atomically increment.
  let card = await StampCard.findOne({ user: userId, merchant: merchant._id });
  if (!card) {
    card = await StampCard.create({ user: userId, merchant: merchant._id });
    await Transaction.create({
      merchant: merchant._id,
      user: userId,
      type: 'join',
      detail: 'Auto-joined on first stamp.',
    });
  }

  const updated = await StampCard.findOneAndUpdate(
    { _id: card._id },
    {
      $inc: { currentStampsCount: 1, totalStampsEarned: 1 },
      $push: { history: { method, at: new Date() } },
    },
    { new: true }
  );

  await Transaction.create({
    merchant: merchant._id,
    user: userId,
    type: 'stamp',
    detail: `Stamp awarded via ${method}.`,
  });

  // Card complete? Generate a reward voucher and reset the counter.
  let rewardEarned = false;
  if (updated.currentStampsCount >= merchant.stampsRequired) {
    const code = generateRewardCode();
    updated.currentStampsCount = 0;
    updated.rewards.push({ code, source: 'card', status: 'available' });
    await updated.save();
    rewardEarned = true;

    const user = await User.findById(userId);
    // Remote redemption: fire a (simulated) email with an online discount code.
    sendNotification({
      to: user.email,
      channel: 'email',
      subject: `Your reward at ${merchant.businessName} is ready!`,
      body: `Congratulations! Your card is full. Use online code ${code} or show the in-app voucher in store. Offer: ${merchant.offerText}.`,
    });
  }

  return { card: updated, rewardEarned };
}

// POST /api/stamp/code  { stampCode }
// Default mechanism: scanning the merchant's static counter code.
router.post('/code', protect, async (req, res) => {
  try {
    const { stampCode } = req.body;
    if (!stampCode) return res.status(400).json({ message: 'Stamp code is required.' });

    const merchant = await Merchant.findOne({ stampCode: stampCode.trim().toUpperCase() });
    if (!merchant) return res.status(404).json({ message: 'Invalid stamp code.' });

    const { card, rewardEarned } = await applyStamp({
      userId: req.user._id,
      merchant,
      method: 'stampCode',
    });

    res.json({
      message: rewardEarned ? 'Card full — reward earned!' : 'Stamp added.',
      rewardEarned,
      currentStampsCount: card.currentStampsCount,
      stampsRequired: merchant.stampsRequired,
      businessName: merchant.businessName,
    });
  } catch (err) {
    res.status(500).json({ message: 'Stamping failed.', error: err.message });
  }
});

// POST /api/stamp/one  { code }
// Pro mechanism: single-use OneStamp codes. Marked used atomically so a code
// can never grant a second stamp, even under concurrent scans.
router.post('/one', protect, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ message: 'OneStamp code is required.' });

    // Atomic claim: only succeeds if currently unused.
    const claimed = await OneStamp.findOneAndUpdate(
      { code: code.trim().toUpperCase(), isUsed: false },
      { isUsed: true, usedBy: req.user._id, usedAt: new Date() },
      { new: true }
    );

    if (!claimed) {
      // Distinguish "already used" from "doesn't exist" for a clearer message.
      const existing = await OneStamp.findOne({ code: code.trim().toUpperCase() });
      if (existing) {
        return res.status(409).json({ message: 'This code has already been used.' });
      }
      return res.status(404).json({ message: 'Invalid OneStamp code.' });
    }

    const merchant = await Merchant.findById(claimed.merchant);
    if (!merchant) return res.status(404).json({ message: 'Merchant not found.' });

    const { card, rewardEarned } = await applyStamp({
      userId: req.user._id,
      merchant,
      method: 'oneStamp',
    });

    res.json({
      message: rewardEarned ? 'Card full — reward earned!' : 'Stamp added.',
      rewardEarned,
      currentStampsCount: card.currentStampsCount,
      stampsRequired: merchant.stampsRequired,
      businessName: merchant.businessName,
    });
  } catch (err) {
    res.status(500).json({ message: 'Stamping failed.', error: err.message });
  }
});

module.exports = { router, applyStamp };
