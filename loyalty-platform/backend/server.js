require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');

const authRoutes = require('./routes/auth');
const memberRoutes = require('./routes/member');
const merchantRoutes = require('./routes/merchant');
const { router: stampRoutes } = require('./routes/stamp');

const app = express();

// --- Core middleware ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Connect to MongoDB ---
connectDB();

// --- Health check (used by Render) ---
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', env: process.env.NODE_ENV || 'development', time: new Date() });
});

// --- API routes ---
app.use('/api/auth', authRoutes);
app.use('/api/member', memberRoutes);
app.use('/api/merchant', merchantRoutes);
app.use('/api/stamp', stampRoutes);

// --- Join redirect: /join/:code → frontend with code prefilled ---
app.get('/join/:code', (req, res) => {
  res.redirect(`/?join=${encodeURIComponent(req.params.code)}`);
});

// --- Serve the static frontend (self-contained single-service deploy) ---
const frontendDir = path.join(__dirname, '..', 'frontend', 'public');
app.use(express.static(frontendDir));

// SPA fallback for any non-API GET route.
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(frontendDir, 'index.html'));
});

// --- Central error handler ---
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Server error.', error: err.message });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

module.exports = app;
