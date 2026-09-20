const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { getMe, saveApiKey, deleteApiKey, saveGeminiModel } = require("../controllers/userController");

// GET /api/users/me — returns profile info including hasCustomKey / maskedKey / geminiModel
router.get("/me", authMiddleware, getMe);

// POST /api/users/apikey — encrypts and saves a Gemini API key for this user
router.post("/apikey", authMiddleware, saveApiKey);

// DELETE /api/users/apikey — removes the user's custom Gemini API key
router.delete("/apikey", authMiddleware, deleteApiKey);

// POST /api/users/geminimodel — saves the user's preferred Gemini model
router.post("/geminimodel", authMiddleware, saveGeminiModel);

module.exports = router;
