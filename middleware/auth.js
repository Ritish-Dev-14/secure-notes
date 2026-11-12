const jwt = require('jsonwebtoken');

/**
 * Authentication Middleware
 * Validates the JWT in the Authorization header and binds the user ID to req.user.
 */
const auth = (req, res, next) => {
  try {
    // 1. Extract Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ message: 'Authorization header missing' });
    }

    // 2. Validate "Bearer <token>" format
    const parts = authHeader.trim().split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({ message: 'Malformed authorization header. Expected: Bearer <token>' });
    }

    const token = parts[1];
    if (!token) {
      return res.status(401).json({ message: 'Token missing' });
    }

    // 3. Verify token signature and expiration
    // This throws an error if token is tampered, invalid, or expired
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 4. Attach authenticated user ID to req.user (ensures user isolation in subsequent handlers)
    req.user = decoded.id;

    next();
  } catch (error) {
    // Handle expired or tampered tokens with 401 Unauthorized
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token has expired' });
    }
    return res.status(401).json({ message: 'Invalid or unauthorized token' });
  }
};

module.exports = auth;
