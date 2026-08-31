const Interview = require("../models/Interview");
const { generateFirstQuestion } = require("../services/geminiService");

// ─── POST /api/interviews ──────────────────────────────────────────────────────
// Creates a new interview, generates the first question via Gemini,
// saves everything, and returns the interview ID + first question.
// Requires: JWT authentication (req.user.userId set by authMiddleware)
const createInterview = async (req, res) => {
  try {
    const { resume, role, difficulty, questionCount, duration } = req.body;

    // ── 1. Validate required fields ──────────────────────────────────────────
    if (!resume || !role || !difficulty || !questionCount || !duration) {
      return res.status(400).json({
        success: false,
        message: "resume, role, difficulty, questionCount, and duration are all required",
      });
    }

    // ── 2. Validate resume ───────────────────────────────────────────────────
    if (typeof resume !== "string" || resume.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "resume must be a non-empty string",
      });
    }
    // Reject excessively large resumes (prevent abuse / huge Gemini prompts)
    if (resume.trim().length > 5000) {
      return res.status(400).json({
        success: false,
        message: "resume is too long (maximum 5000 characters)",
      });
    }

    // ── 3. Validate role ─────────────────────────────────────────────────────
    if (typeof role !== "string" || role.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "role must be a non-empty string",
      });
    }

    // ── 4. Validate difficulty ───────────────────────────────────────────────
    const allowedDifficulties = ["easy", "medium", "hard"];
    if (!allowedDifficulties.includes(difficulty)) {
      return res.status(400).json({
        success: false,
        message: `difficulty must be one of: ${allowedDifficulties.join(", ")}`,
      });
    }

    // ── 5. Validate questionCount ────────────────────────────────────────────
    const qCount = Number(questionCount);
    if (!Number.isInteger(qCount) || qCount < 1 || qCount > 20) {
      return res.status(400).json({
        success: false,
        message: "questionCount must be an integer between 1 and 20",
      });
    }

    // ── 6. Validate duration ─────────────────────────────────────────────────
    const dur = Number(duration);
    if (!Number.isFinite(dur) || dur < 1 || dur > 120) {
      return res.status(400).json({
        success: false,
        message: "duration must be a number between 1 and 120 (minutes)",
      });
    }

    // ── 7. Get authenticated user's ID from JWT (never from req.body) ────────
    const userId = req.user.userId;

    // ── 8. Call Gemini BEFORE creating the interview document ────────────────
    //    Reason: if Gemini fails, we don't want a half-created interview in DB
    let firstQuestion;
    try {
      firstQuestion = await generateFirstQuestion({
        resume: resume.trim(),
        role: role.trim(),
        difficulty,
        questionCount: qCount,
        duration: dur,
      });
    } catch (geminiErr) {
      console.error("Gemini error:", geminiErr.message);
      return res.status(502).json({
        success: false,
        message: "Unable to generate interview question. Please try again.",
      });
    }

    // ── 9. Create and save the Interview document ────────────────────────────
    const interview = await Interview.create({
      userId,                        // from JWT — not from request body
      resume: resume.trim(),
      role: role.trim(),
      difficulty,
      questionCount: qCount,
      duration: dur,
      status: "in_progress",         // Gemini succeeded, interview is live
      questionsAsked: 1,             // first question counts
      startedAt: new Date(),
      conversation: [
        {
          role: "interviewer",
          text: firstQuestion.question,
          topic: firstQuestion.topic,
          difficulty: firstQuestion.difficulty,
        },
      ],
    });

    // ── 10. Return response ──────────────────────────────────────────────────
    return res.status(201).json({
      success: true,
      message: "Interview created successfully",
      data: {
        interviewId: interview._id,
        question: {
          text: firstQuestion.question,
          topic: firstQuestion.topic,
          difficulty: firstQuestion.difficulty,
        },
      },
    });
  } catch (err) {
    console.error("Create interview error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = { createInterview };
