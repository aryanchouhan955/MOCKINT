const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { getMe } = require("../controllers/userController");

// GET /api/users/me — protected route (JWT required)
router.get("/me", authMiddleware, getMe);

module.exports = router;
