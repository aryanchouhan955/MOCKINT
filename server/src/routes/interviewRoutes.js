const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const {
  getInterviewHistory,
  getInterviewById,
  createInterview,
  submitAnswer,
  completeInterview,
  cancelInterview,
} = require("../controllers/interviewController");

// GET /api/interviews — protected (JWT required)
router.get("/", authMiddleware, getInterviewHistory);

// GET /api/interviews/:id — protected (JWT required)
router.get("/:id", authMiddleware, getInterviewById);

// POST /api/interviews — protected (JWT required)
router.post("/", authMiddleware, createInterview);

// POST /api/interviews/:id/answer — protected (JWT required)
router.post("/:id/answer", authMiddleware, submitAnswer);

// POST /api/interviews/:id/complete — protected (JWT required)
router.post("/:id/complete", authMiddleware, completeInterview);

// POST /api/interviews/:id/cancel — protected (JWT required)
router.post("/:id/cancel", authMiddleware, cancelInterview);

module.exports = router;
