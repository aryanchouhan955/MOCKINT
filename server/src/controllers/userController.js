const User = require("../models/User");

// ─── GET /api/users/me ─────────────────────────────────────────────────────────
// Protected: requires valid JWT (set by authMiddleware)
const getMe = async (req, res) => {
  try {
    // req.user.userId is set by authMiddleware after verifying the JWT
    // We query DB here (not just trust JWT payload) to ensure:
    //  - user still exists (wasn't deleted after token was issued)
    //  - we return up-to-date data
    // We use .select("-password") to explicitly exclude the password hash
    const user = await User.findById(req.user.userId).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (err) {
    console.error("Get me error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = { getMe };
