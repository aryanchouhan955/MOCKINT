const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { createInterview, submitAnswer, completeInterview, cancelInterview } = require("../controllers/interviewController");

// POST /api/interviews — protected (JWT required)
router.post("/", authMiddleware, createInterview);

// POST /api/interviews/:id/answer — protected (JWT required)
router.post("/:id/answer", authMiddleware, submitAnswer);

// POST /api/interviews/:id/complete — protected (JWT required)
router.post("/:id/complete", authMiddleware, completeInterview);

// POST /api/interviews/:id/cancel — protected (JWT required)
router.post("/:id/cancel", authMiddleware, cancelInterview);

module.exports = router;
