const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const REDEEM_WINDOW_MS = 3 * 60 * 1000; // 3-minute in-person redemption window.

const signToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
};

const generateRewardCode = () =>
  'RWD-' + crypto.randomBytes(4).toString('hex').toUpperCase();

// Placeholder notification service. In production swap this for SendGrid / Twilio.
// We log to the server so behaviour is observable without external credentials.
const sendNotification = ({ to, channel, subject, body }) => {
  console.log('--- SIMULATED NOTIFICATION ---');
  console.log(`Channel : ${channel}`);
  console.log(`To      : ${to}`);
  if (subject) console.log(`Subject : ${subject}`);
  console.log(`Body    : ${body}`);
  console.log('------------------------------');
  return { delivered: true, channel, to, sentAt: new Date() };
};

module.exports = { signToken, generateRewardCode, sendNotification, REDEEM_WINDOW_MS };
