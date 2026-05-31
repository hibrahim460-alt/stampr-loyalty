const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User'); 
const { sendVerificationEmail } = require('../config/mailer');

// ========================================================
// 1. SIGN-UP ENDPOINT (Creates account & fires email code)
// ========================================================
router.post('/signup', async (req, res) => {
  try {
    const { email, password, role } = req.body;

    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Generate a secure 6-digit random code string
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const codeExpiration = Date.now() + 15 * 60 * 1000; // Code expires in 15 minutes

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Save user to the database with verification flags
    user = new User({
      email,
      password: hashedPassword,
      role: role || 'member',
      isVerified: false,
      verificationCode: code,
      verificationExpires: codeExpiration
    });
    await user.save();

    // Send the branded transactional email using your Google Workspace OAuth2 configurations
    await sendVerificationEmail(email, code);

    res.status(201).json({ 
      message: 'Registration initiated successfully. Please check your email for the verification code.' 
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// ========================================================
// 2. VERIFICATION ENDPOINT (Validates the 6-digit code)
// ========================================================
router.post('/verify-email', async (req, res) => {
  try {
    const { email, code } = req.body;

    // Find the user trying to verify
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User profile not found' });
    }

    // Check if user has already gone through this process
    if (user.isVerified) {
      return res.status(400).json({ message: 'Account is already verified' });
    }

    // Validation Check: Check if code has timed out
    if (Date.now() > user.verificationExpires) {
      return res.status(400).json({ message: 'Verification code has expired. Please sign up again.' });
    }

    // Validation Check: Does the code match what we sent?
    if (user.verificationCode !== code) {
      return res.status(400).json({ message: 'Invalid verification code' });
    }

    // Success: Activate user and clear tracking code fields out of the database
    user.isVerified = true;
    user.verificationCode = undefined;
    user.verificationExpires = undefined;
    await user.save();

    // Issue standard Authorization token directly so they are seamlessly logged in
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.status(200).json({ 
      message: 'Email verified successfully!', 
      token, 
      role: user.role 
    });
  } catch (err) {
    console.error('Verification error:', err);
    res.status(500).json({ message: 'Server error during verification matching' });
  }
});

// ========================================================
// 3. LOGIN ENDPOINT (Protects system from unverified entry)
// ========================================================
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Look for user record
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check password match
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // SECURITY LOCKOUT: Check if email has been verified yet
    if (!user.isVerified) {
      return res.status(403).json({ 
        message: 'Your email address is unverified. Please check your inbox or complete verification before logging in.' 
      });
    }

    // Issue login Token
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.status(200).json({ token, role: user.role });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error during login authentication' });
  }
});

module.exports = router;
