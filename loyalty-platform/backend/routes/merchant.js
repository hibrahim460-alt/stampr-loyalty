const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Merchant = require('../models/Merchant');
const StampCard = require('../models/StampCard');
const OneStamp = require('../models/OneStamp');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/authMiddleware');
const { applyStamp } = require('./stamp');
const { sendNotification, generateRewardCode } = require('../utils');

router.use(protect, authorize('merchant', 'admin'));

// Resolve the merchant profile owned by the logged-in user.
async function getOwnMerchant(req, res) {
  const merchant = await Merchant.findById(req.user.merchantProfile);
  if (!merchant) {
    res.status(404).json({ message: 'Merchant profile not found.' });
    return null;
  }
  return merchant;
}

// GET /api/merchant/profile
router.get('/profile', async (req, res) => {
  const merchant = await getOwnMerchant(req, res);
  if (!merchant) return;
  res.json(merchant);
});

// PUT /api/merchant/profile  — edit offer text, stamps required, logo, etc.
router.put('/profile', async (req, res) => {
  try {
    const merchant = await getOwnMerchant(req, res);
    if (!merchant) return;

    const { businessName, logoUrl, location, offerText, stampsRequired, birthdayClubEnabled } = req.body;
    if (businessName !== undefined) merchant.businessName = businessName;
    if (logoUrl !== undefined) merchant.logoUrl = logoUrl;
    if (location !== undefined) merchant.location = location;
    if (offerText !== undefined) merchant.offerText = offerText;
    if (stampsRequired !== undefined) merchant.stampsRequired = Math.max(2, Number(stampsRequired));
    if (birthdayClubEnabled !== undefined) merchant.birthdayClubEnabled = !!birthdayClubEnabled;

    await merchant.save();
    res.json(merchant);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update profile.', error: err.message });
  }
});

// GET /api/merchant/analytics — real-time dashboard figures.
router.get('/analytics', async (req, res) => {
  try {
    const merchant = await getOwnMerchant(req, res);
    if (!merchant) return;
    const mId = merchant._id;

    const [totalMembers, totalStamps, totalRedemptions, recent] = await Promise.all([
      StampCard.countDocuments({ merchant: mId }),
      Transaction.countDocuments({ merchant: mId, type: 'stamp' }),
      Transaction.countDocuments({ merchant: mId, type: { $in: ['redeem', 'birthday_reward'] } }),
      Transaction.find({ merchant: mId })
        .sort({ createdAt: -1 })
        .limit(15)
        .populate('user', 'name email'),
    ]);

    res.json({
      totalMembers,
      totalStamps,
      totalRedemptions,
      joinCode: merchant.joinCode,
      stampCode: merchant.stampCode,
      offerText: merchant.offerText,
      stampsRequired: merchant.stampsRequired,
      recentActivity: recent.map((t) => ({
        type: t.type,
        detail: t.detail,
        user: t.user ? t.user.name : 'Unknown',
        at: t.createdAt,
      })),
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load analytics.', error: err.message });
  }
});

// GET /api/merchant/members
router.get('/members', async (req, res) => {
  try {
    const merchant = await getOwnMerchant(req, res);
    if (!merchant) return;
    const cards = await StampCard.find({ merchant: merchant._id }).populate(
      'user',
      'name email birthday'
    );
    res.json(
      cards.map((c) => ({
        cardId: c._id,
        userId: c.user ? c.user._id : null,
        name: c.user ? c.user.name : 'Deleted user',
        email: c.user ? c.user.email : '',
        birthday: c.user ? c.user.birthday : null,
        currentStampsCount: c.currentStampsCount,
        totalStampsEarned: c.totalStampsEarned,
        availableRewards: c.rewards.filter((r) => r.status === 'available').length,
      }))
    );
  } catch (err) {
    res.status(500).json({ message: 'Failed to load members.', error: err.message });
  }
});

// POST /api/merchant/members  { name, email, password? }
// Manually add a member: creates the user if needed, then a stamp card.
router.post('/members', async (req, res) => {
  try {
    const merchant = await getOwnMerchant(req, res);
    if (!merchant) return;
    const { name, email, password, birthday } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required.' });

    let user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      user = await User.create({
        name: name || email.split('@')[0],
        email,
        password: password || Math.random().toString(36).slice(2, 10),
        role: 'member',
        birthday: birthday || null,
      });
    }

    const existing = await StampCard.findOne({ user: user._id, merchant: merchant._id });
    if (existing) {
      return res.status(409).json({ message: 'This member is already enrolled.' });
    }

    await StampCard.create({ user: user._id, merchant: merchant._id });
    await Transaction.create({
      merchant: merchant._id,
      user: user._id,
      type: 'join',
      detail: 'Manually added by merchant.',
    });

    res.status(201).json({ message: `${user.name} added.`, userId: user._id });
  } catch (err) {
    res.status(500).json({ message: 'Failed to add member.', error: err.message });
  }
});

// POST /api/merchant/stamp  { userId }  — manually allocate one stamp.
router.post('/stamp', async (req, res) => {
  try {
    const merchant = await getOwnMerchant(req, res);
    if (!merchant) return;
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ message: 'userId is required.' });

    const { card, rewardEarned } = await applyStamp({ userId, merchant, method: 'manual' });
    res.json({
      message: rewardEarned ? 'Stamp added — reward earned!' : 'Stamp added.',
      rewardEarned,
      currentStampsCount: card.currentStampsCount,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to allocate stamp.', error: err.message });
  }
});

// POST /api/merchant/onestamps  { quantity }  — generate single-use Pro codes.
router.post('/onestamps', async (req, res) => {
  try {
    const merchant = await getOwnMerchant(req, res);
    if (!merchant) return;
    const quantity = Math.min(100, Math.max(1, Number(req.body.quantity) || 1));

    const docs = Array.from({ length: quantity }, () => ({ merchant: merchant._id }));
    const created = await OneStamp.insertMany(docs);
    res.status(201).json({
      message: `${created.length} OneStamps generated.`,
      codes: created.map((c) => c.code),
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to generate OneStamps.', error: err.message });
  }
});

// GET /api/merchant/onestamps  — list generated codes and their state.
router.get('/onestamps', async (req, res) => {
  try {
    const merchant = await getOwnMerchant(req, res);
    if (!merchant) return;
    const codes = await OneStamp.find({ merchant: merchant._id })
      .sort({ createdAt: -1 })
      .limit(200);
    res.json(
      codes.map((c) => ({ code: c.code, isUsed: c.isUsed, usedAt: c.usedAt }))
    );
  } catch (err) {
    res.status(500).json({ message: 'Failed to load OneStamps.', error: err.message });
  }
});

// POST /api/merchant/broadcast  { channel, message }  — simulate push/SMS to all members.
router.post('/broadcast', async (req, res) => {
  try {
    const merchant = await getOwnMerchant(req, res);
    if (!merchant) return;
    const { channel = 'push', message } = req.body;
    if (!message) return res.status(400).json({ message: 'Message is required.' });

    const cards = await StampCard.find({ merchant: merchant._id }).populate('user', 'name email');
    let sent = 0;
    cards.forEach((c) => {
      if (!c.user) return;
      sendNotification({
        to: c.user.email,
        channel,
        subject: `${merchant.businessName} update`,
        body: message,
      });
      sent++;
    });

    res.json({ message: `Broadcast simulated to ${sent} member(s) via ${channel}.`, recipients: sent });
  } catch (err) {
    res.status(500).json({ message: 'Failed to send broadcast.', error: err.message });
  }
});

// POST /api/merchant/birthday-run
// Birthday Club: when enabled, scan members whose birthday is today and who
// have not yet received this year's reward; issue a birthday voucher + log it.
router.post('/birthday-run', async (req, res) => {
  try {
    const merchant = await getOwnMerchant(req, res);
    if (!merchant) return;
    if (!merchant.birthdayClubEnabled) {
      return res.status(400).json({ message: 'Birthday Club is disabled.' });
    }

    const today = new Date();
    const cards = await StampCard.find({ merchant: merchant._id }).populate(
      'user',
      'name email birthday lastBirthdayRewardYear'
    );

    let issued = 0;
    for (const card of cards) {
      const u = card.user;
      if (!u || !u.birthday) continue;
      const bday = new Date(u.birthday);
      const isBirthday =
        bday.getMonth() === today.getMonth() && bday.getDate() === today.getDate();
      const alreadyThisYear = u.lastBirthdayRewardYear === today.getFullYear();
      if (!isBirthday || alreadyThisYear) continue;

      const code = generateRewardCode();
      card.rewards.push({ code, source: 'birthday', status: 'available' });
      await card.save();

      await User.findByIdAndUpdate(u._id, { lastBirthdayRewardYear: today.getFullYear() });
      await Transaction.create({
        merchant: merchant._id,
        user: u._id,
        type: 'birthday_reward',
        detail: `Birthday voucher ${code} issued.`,
      });
      sendNotification({
        to: u.email,
        channel: 'email',
        subject: `Happy Birthday from ${merchant.businessName}!`,
        body: `Enjoy a birthday treat on us. Voucher code: ${code}.`,
      });
      issued++;
    }

    res.json({ message: `Birthday run complete. ${issued} voucher(s) issued.`, issued });
  } catch (err) {
    res.status(500).json({ message: 'Birthday run failed.', error: err.message });
  }
});

module.exports = router;
