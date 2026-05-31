const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Merchant = require('../models/Merchant');
const { signToken } = require('../utils');
const { protect } = require('../middleware/authMiddleware');

// POST /api/auth/register
// Registers a member or a merchant. Merchant registration also creates the
// associated Merchant business profile.
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, birthday, businessName } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required.' });
    }

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }

    const finalRole = ['member', 'merchant'].includes(role) ? role : 'member';

    const user = await User.create({
      name,
      email,
      password,
      role: finalRole,
      birthday: birthday || null,
    });

    let merchant = null;
    if (finalRole === 'merchant') {
      merchant = await Merchant.create({
        owner: user._id,
        businessName: businessName || `${name}'s Shop`,
      });
      user.merchantProfile = merchant._id;
      await user.save();
    }

    res.status(201).json({
      token: signToken(user),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        birthday: user.birthday,
        merchantId: merchant ? merchant._id : null,
      },
    });
  } catch (err) {
    res.status(500).json({ message: 'Registration failed.', error: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    res.json({
      token: signToken(user),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        birthday: user.birthday,
        merchantId: user.merchantProfile,
      },
    });
  } catch (err) {
    res.status(500).json({ message: 'Login failed.', error: err.message });
  }
});

// GET /api/auth/me
router.get('/me', protect, async (req, res) => {
  res.json({
    id: req.user._id,
    name: req.user.name,
    email: req.user.email,
    role: req.user.role,
    birthday: req.user.birthday,
    merchantId: req.user.merchantProfile,
  });
});

module.exports = router;
