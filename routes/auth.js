const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Regular expression to validate standard email format
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/auth/register
 * Register a new user with name, email, and password.
 */
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body || {};

    // 1. Input presence & type validation (prevents TypeError and NoSQL operator injection)
    if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ message: 'Name, email, and password must be valid text values' });
    }

    const trimmedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (!trimmedName) {
      return res.status(400).json({ message: 'Name cannot be empty' });
    }

    // 2. Email format validation
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({ message: 'Please provide a valid email address' });
    }

    // 3. Password length requirement (minimum 6 characters)
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    // 4. Duplicate email check (409 Conflict)
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }

    // 5. Password hashing with bcryptjs (10 salt rounds) - never store plain text passwords
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 6. Save the user with hashed password
    const newUser = new User({
      name: trimmedName,
      email: normalizedEmail,
      password: hashedPassword,
    });
    await newUser.save();

    // 7. Return 201 Created confirmation (exclude all password data)
    return res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error('Registration error:', error.message);
    return res.status(500).json({ message: 'Server error during registration' });
  }
});

/**
 * POST /api/auth/login
 * Authenticate user, verify hashed password, and issue a signed JWT.
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};

    // 1. Validate required fields and types (prevents NoSQL operator injection)
    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // 2. Find user in database by normalized email
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      // Generic error message: prevents email enumeration attacks
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // 3. Verify password against stored bcrypt hash
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      // Same generic message to avoid revealing whether email or password was wrong
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // 4. Sign JWT containing ONLY the user ID in payload (no email or password in token)
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '1d' } // Expires in 24 hours
    );

    // 5. Return token and safe user details (exclude password entirely)
    return res.status(200).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error('Login error:', error.message);
    return res.status(500).json({ message: 'Server error during login' });
  }
});

module.exports = router;
