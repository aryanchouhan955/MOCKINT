const jwt = require("jsonwebtoken");

// ─── JWT Authentication Middleware ────────────────────────────────────────────
// Protects routes by requiring a valid Bearer token in the Authorization header.
// Usage: add `authMiddleware` before any route handler you want to protect.
const authMiddleware = (req, res, next) => {
  // 1. Check that the Authorization header exists
  const authHeader = req.headers["authorization"];
  if (!authHeader) {
    return res.status(401).json({
      success: false,
      message: "Access denied. No token provided.",
    });
  }

  // 2. Check that it follows the "Bearer <token>" format
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return res.status(401).json({
      success: false,
      message: "Access denied. Invalid token format. Use: Bearer <token>",
    });
  }

  const token = parts[1];

  // 3. Verify the token using JWT_SECRET
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 4. Attach userId to req.user so downstream controllers can use it
    req.user = {
      userId: decoded.userId,
    };

    // 5. Token is valid — continue to the next middleware/controller
    next();
  } catch (err) {
    // Handles: expired tokens, malformed tokens, invalid signatures
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token has expired. Please log in again.",
      });
    }
    return res.status(401).json({
      success: false,
      message: "Invalid token.",
    });
  }
};

module.exports = authMiddleware;
