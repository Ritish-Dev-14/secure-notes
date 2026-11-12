require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const noteRoutes = require('./routes/notes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static frontend files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Serverless-safe cached MongoDB connection (reused across warm Vercel invocations)
const cached = global._mongooseCache || (global._mongooseCache = { conn: null, promise: null });

async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }

  const mongoUri = process.env.MONGO_URI || (!process.env.VERCEL ? 'mongodb://127.0.0.1:27017/secure_notes' : '');
  if (!mongoUri) {
    throw new Error('MONGO_URI environment variable is not configured.');
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(mongoUri, { bufferCommands: false })
      .then((mongooseInstance) => mongooseInstance)
      .catch((err) => {
        cached.promise = null;
        throw err;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

// Ensure environment secrets & DB connection are ready before handling any API request
app.use('/api', async (req, res, next) => {
  if (!process.env.JWT_SECRET) {
    return res.status(503).json({ message: 'Server configuration error: JWT_SECRET is missing' });
  }
  try {
    await connectDB();
    return next();
  } catch (error) {
    console.error('Database connection error:', error.message);
    return res.status(503).json({ message: 'Database connection unavailable' });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/notes', noteRoutes);

// Fallback 404 handler for undefined API routes
app.use('/api', (req, res) => {
  res.status(404).json({ message: 'API route not found' });
});

// Single Page Application (SPA) fallback: serve index.html for non-API requests
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global error handling middleware
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ message: 'Invalid JSON payload' });
  }
  console.error('Unhandled Server Error:', err.message);
  return res.status(500).json({ message: 'Internal server error' });
});

// Start HTTP server only when executed directly (e.g., local dev), not when imported by Vercel
if (require.main === module) {
  if (!process.env.JWT_SECRET) {
    console.error('FATAL: JWT_SECRET environment variable is not defined.');
    process.exit(1);
  }

  connectDB()
    .then(() => {
      console.log('Connected to MongoDB successfully');
      app.listen(PORT, () => {
        console.log(`Secure Notes server is running at http://localhost:${PORT}`);
      });
    })
    .catch((err) => {
      console.error('Failed to connect to MongoDB:', err.message);
      process.exit(1);
    });
}

module.exports = app;
