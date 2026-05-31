const express = require('express');
const router = express.Router();
const Merchant = require('../models/Merchant');
const StampCard = require('../models/StampCard');
const Transaction = require('../models/Transaction');
const { protect, authorize } = require('../middleware/authMiddleware');
const { REDEEM_WINDOW_MS } = require('../utils');

// All member routes require an authenticated member.
router.use(protect, authorize('member', 'admin'));

// Compute live reward status, expiring any voucher whose 3-minute window passed.
// Persists expirations so the dashboard stays accurate.
async function reconcileRewards(card) {
  let mutated = false;
  const now = Date.now();
  card.rewards.forEach((r) => {
    if (r.status === 'redeeming' && r.redeemStartedAt) {
      if (now - new Date(r.redeemStartedAt).getTime() > REDEEM_WINDOW_MS) {
        r.status = 'expired';
        mutated = true;
      }
    }
  });
  if (mutated) await card.save();
  return card;
}

// GET /api/member/merchants?search=coffee
router.get('/merchants', async (req, res) => {
  try {
    const { search } = req.query;
    const filter = search
      ? { businessName: { $regex: search, $options: 'i' } }
      : {};
    const merchants = await Merchant.find(filter)
      .select('businessName logoUrl location offerText stampsRequired joinCode')
      .limit(50);
    res.json(merchants);
  } catch (err) {
    res.status(500).json({ message: 'Failed to load merchants.', error: err.message });
  }
});

// POST /api/member/join  { joinCode }
// Join via a join code (the join URL redirects here). Idempotent.
router.post('/join', async (req, res) => {
  try {
    const { joinCode } = req.body;
    if (!joinCode) return res.status(400).json({ message: 'Join code is required.' });

    const merchant = await Merchant.findOne({ joinCode: joinCode.trim().toUpperCase() });
    if (!merchant) return res.status(404).json({ message: 'Invalid join code.' });

    let card = await StampCard.findOne({ user: req.user._id, merchant: merchant._id });
    if (card) {
      return res.json({ message: 'Already a member.', alreadyJoined: true, merchantId: merchant._id });
    }

    card = await StampCard.create({ user: req.user._id, merchant: merchant._id });
    await Transaction.create({
      merchant: merchant._id,
      user: req.user._id,
      type: 'join',
      detail: 'Joined via join code.',
    });

    res.status(201).json({
      message: `Joined ${merchant.businessName}!`,
      merchantId: merchant._id,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to join program.', error: err.message });
  }
});

// GET /api/member/cards
router.get('/cards', async (req, res) => {
  try {
    const cards = await StampCard.find({ user: req.user._id }).populate(
      'merchant',
      'businessName logoUrl offerText stampsRequired location'
    );
    for (const card of cards) await reconcileRewards(card);
    res.json(cards);
  } catch (err) {
    res.status(500).json({ message: 'Failed to load cards.', error: err.message });
  }
});

// GET /api/member/rewards
// Returns all available/active rewards across the member's cards.
router.get('/rewards', async (req, res) => {
  try {
    const cards = await StampCard.find({ user: req.user._id }).populate(
      'merchant',
      'businessName logoUrl offerText'
    );
    const rewards = [];
    for (const card of cards) {
      await reconcileRewards(card);
      card.rewards
        .filter((r) => ['available', 'redeeming'].includes(r.status))
        .forEach((r) => {
          const remainingMs =
            r.status === 'redeeming' && r.redeemStartedAt
              ? Math.max(0, REDEEM_WINDOW_MS - (Date.now() - new Date(r.redeemStartedAt).getTime()))
              : null;
          rewards.push({
            rewardId: r._id,
            cardId: card._id,
            code: r.code,
            status: r.status,
            source: r.source,
            earnedAt: r.earnedAt,
            remainingMs,
            merchant: {
              id: card.merchant._id,
              businessName: card.merchant.businessName,
              logoUrl: card.merchant.logoUrl,
              offerText: card.merchant.offerText,
            },
          });
        });
    }
    res.json(rewards);
  } catch (err) {
    res.status(500).json({ message: 'Failed to load rewards.', error: err.message });
  }
});

// POST /api/member/rewards/:cardId/:rewardId/redeem
// Starts the 3-minute in-person redemption window. Member shows the live screen
// to staff; after 3 minutes it auto-expires server-side and client-side.
router.post('/rewards/:cardId/:rewardId/redeem', async (req, res) => {
  try {
    const { cardId, rewardId } = req.params;
    const card = await StampCard.findOne({ _id: cardId, user: req.user._id });
    if (!card) return res.status(404).json({ message: 'Card not found.' });

    const reward = card.rewards.id(rewardId);
    if (!reward) return res.status(404).json({ message: 'Reward not found.' });

    await reconcileRewards(card);
    if (reward.status === 'expired') {
      return res.status(410).json({ message: 'This voucher has expired.' });
    }
    if (reward.status === 'redeemed') {
      return res.status(409).json({ message: 'This voucher was already redeemed.' });
    }

    // Start (or restart if still available) the countdown.
    if (reward.status === 'available') {
      reward.status = 'redeeming';
      reward.redeemStartedAt = new Date();
      await card.save();
    }

    const remainingMs = Math.max(
      0,
      REDEEM_WINDOW_MS - (Date.now() - new Date(reward.redeemStartedAt).getTime())
    );

    res.json({
      message: 'Redemption window started. Show this screen to staff.',
      rewardId: reward._id,
      code: reward.code,
      windowMs: REDEEM_WINDOW_MS,
      remainingMs,
      redeemStartedAt: reward.redeemStartedAt,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to start redemption.', error: err.message });
  }
});

// POST /api/member/rewards/:cardId/:rewardId/confirm
// Staff-confirmed completion within the window — marks the voucher redeemed and logs it.
router.post('/rewards/:cardId/:rewardId/confirm', async (req, res) => {
  try {
    const { cardId, rewardId } = req.params;
    const card = await StampCard.findOne({ _id: cardId, user: req.user._id });
    if (!card) return res.status(404).json({ message: 'Card not found.' });

    const reward = card.rewards.id(rewardId);
    if (!reward) return res.status(404).json({ message: 'Reward not found.' });

    await reconcileRewards(card);
    if (reward.status !== 'redeeming') {
      return res.status(410).json({ message: 'Voucher is no longer active.' });
    }

    reward.status = 'redeemed';
    reward.redeemedAt = new Date();
    await card.save();

    await Transaction.create({
      merchant: card.merchant,
      user: req.user._id,
      type: 'redeem',
      detail: `Voucher ${reward.code} redeemed in store.`,
    });

    res.json({ message: 'Reward redeemed. Enjoy!', code: reward.code });
  } catch (err) {
    res.status(500).json({ message: 'Failed to confirm redemption.', error: err.message });
  }
});

module.exports = router;
