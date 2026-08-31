const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { createInterview } = require("../controllers/interviewController");

// POST /api/interviews — protected (JWT required)
router.post("/", authMiddleware, createInterview);

module.exports = router;
