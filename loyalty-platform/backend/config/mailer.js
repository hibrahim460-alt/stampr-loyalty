const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com', // Explicitly use the Google SMTP server address
  port: 587,              // 🔥 Use Port 587 (Render leaves this open!)
  secure: false,          // 🔥 Must be false for port 587 (uses STARTTLS)
  auth: {
    type: 'OAuth2',
    user: process.env.EMAIL_USER,
    clientId: process.env.OAUTH_CLIENT_ID,
    clientSecret: process.env.OAUTH_CLIENT_SECRET,
    refreshToken: process.env.OAUTH_REFRESH_TOKEN
  }
});

const sendVerificationEmail = async (email, code) => {
  const mailOptions = {
    from: `"WH Hotel Stampr" <${process.env.EMAIL_USER}>`, 
    to: email,
    subject: 'Verify Your WH Hotel Account 🔐',
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 500px; border: 1px solid #ddd; border-radius: 8px;">
        <h2 style="color: #1a1a1a;">Welcome to WH Hotel Loyalty Platform!</h2>
        <p>Thank you for registering. Please use the following 6-digit verification code to complete your signup process:</p>
        <div style="font-size: 28px; font-weight: bold; padding: 15px; background: #f8f9fa; text-align: center; letter-spacing: 6px; margin: 20px 0; border: 1px dashed #ccc; color: #007bff;">
          ${code}
        </div>
        <p style="color: #666; font-size: 13px;">This security code is highly sensitive and will expire in 15 minutes.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin-top: 20px;" />
        <p style="color: #999; font-size: 11px; text-align: center;">This is an automated operational email. Please do not reply directly to this address.</p>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
};

module.exports = { sendVerificationEmail };
