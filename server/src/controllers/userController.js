const User = require("../models/User");
const { encrypt, decrypt } = require("../utils/encryption");

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

    // Compute a masked version of the API key for display (e.g. "•••••A1B2")
    // We never return the raw or encrypted key — only a safe indicator
    let maskedKey = null;
    if (user.geminiApiKey) {
      try {
        const raw = decrypt(user.geminiApiKey);
        // Show last 4 characters only
        maskedKey = "•••••" + raw.slice(-4);
      } catch {
        // Decryption failure (e.g. key rotation) — treat as no key
        maskedKey = null;
      }
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        hasCustomKey: !!user.geminiApiKey,
        maskedKey,
        geminiModel: user.geminiModel || null,
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

// ─── POST /api/users/apikey ────────────────────────────────────────────────────
// Saves an encrypted Gemini API key to the user's profile.
// The plain-text key is never persisted — only the AES-256-CBC encrypted form.
const saveApiKey = async (req, res) => {
  try {
    const { apiKey } = req.body;

    if (!apiKey || typeof apiKey !== "string" || apiKey.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "A valid API key is required.",
      });
    }

    const trimmedKey = apiKey.trim();

    // Basic sanity check: Gemini API keys start with "AIza"
    if (!trimmedKey.startsWith("AIza")) {
      return res.status(400).json({
        success: false,
        message: "That doesn't look like a valid Gemini API key (should start with 'AIza').",
      });
    }

    const encrypted = encrypt(trimmedKey);

    await User.findByIdAndUpdate(req.user.userId, { geminiApiKey: encrypted });

    const maskedKey = "•••••" + trimmedKey.slice(-4);

    return res.status(200).json({
      success: true,
      message: "API key saved successfully.",
      hasCustomKey: true,
      maskedKey,
    });
  } catch (err) {
    console.error("Save API key error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to save API key. Please try again.",
    });
  }
};

// ─── DELETE /api/users/apikey ──────────────────────────────────────────────────
// Removes the user's custom Gemini API key. Subsequent interviews will use the
// system-level key from the server's .env.
const deleteApiKey = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.userId, { geminiApiKey: null });

    return res.status(200).json({
      success: true,
      message: "API key removed. Interviews will now use the system key.",
      hasCustomKey: false,
      maskedKey: null,
    });
  } catch (err) {
    console.error("Delete API key error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to remove API key. Please try again.",
    });
  }
};

// ─── POST /api/users/geminimodel ───────────────────────────────────────────────
// Saves the user's preferred Gemini model. Pass null or "default" to reset
// back to the system default (gemini-2.5-flash).
const ALLOWED_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
];

const saveGeminiModel = async (req, res) => {
  try {
    const { model } = req.body;

    // null / "default" / empty → reset to system default
    if (!model || model === "default") {
      await User.findByIdAndUpdate(req.user.userId, { geminiModel: null });
      return res.status(200).json({
        success: true,
        message: "Gemini model reset to system default.",
        geminiModel: null,
      });
    }

    if (!ALLOWED_MODELS.includes(model)) {
      return res.status(400).json({
        success: false,
        message: `Invalid model. Allowed values: ${ALLOWED_MODELS.join(", ")}.`,
      });
    }

    await User.findByIdAndUpdate(req.user.userId, { geminiModel: model });

    return res.status(200).json({
      success: true,
      message: `Gemini model set to ${model}.`,
      geminiModel: model,
    });
  } catch (err) {
    console.error("Save Gemini model error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to save model preference. Please try again.",
    });
  }
};

module.exports = { getMe, saveApiKey, deleteApiKey, saveGeminiModel };
