const mongoose = require('mongoose');

const connectDB = async () => {
  if (!process.env.MONGODB_URI) {
    console.error('FATAL: MONGODB_URI is not defined in environment variables.');
    process.exit(1);
  }

  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    // Retry once after 5s before giving up — helps on cold starts (free tier).
    setTimeout(async () => {
      try {
        const conn = await mongoose.connect(process.env.MONGODB_URI);
        console.log(`MongoDB connected on retry: ${conn.connection.host}`);
      } catch (retryErr) {
        console.error(`MongoDB retry failed: ${retryErr.message}`);
        process.exit(1);
      }
    }, 5000);
  }

  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected. Mongoose will attempt to reconnect.');
  });
};

module.exports = connectDB;
