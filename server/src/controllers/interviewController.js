const Interview = require("../models/Interview");
const { generateFirstQuestion, generateNextQuestion, generateInterviewFeedback } = require("../services/geminiService");

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

// ─── Helper for Duplicate Checking ──────────────────────────────────────────
function normalizeQuestion(q) {
  return q.toLowerCase().trim().replace(/[?!.]/g, "");
}

// ─── POST /api/interviews/:id/answer ──────────────────────────────────────────
// Submits a candidate's answer, evaluates interview state, and generates the
// next question adaptively using Gemini, or ends the interview if limits reached.
// Requires: JWT authentication
const submitAnswer = async (req, res) => {
  try {
    const interviewId = req.params.id;
    const { answer } = req.body;
    const userId = req.user.userId;

    // 1. Validate answer
    if (!answer || typeof answer !== "string" || answer.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "answer is required and must be a non-empty string",
      });
    }
    if (answer.length > 3000) {
      return res.status(400).json({
        success: false,
        message: "answer is too long (maximum 3000 characters)",
      });
    }

    // 2. Find interview & verify ownership
    const interview = await Interview.findOne({ _id: interviewId, userId });
    if (!interview) {
      return res.status(404).json({
        success: false,
        message: "Interview not found or unauthorized",
      });
    }

    // 3. Verify active status
    if (interview.status !== "in_progress") {
      return res.status(400).json({
        success: false,
        message: "Interview is no longer active",
      });
    }

    // 4. Add candidate's answer to conversation
    interview.conversation.push({
      role: "candidate",
      text: answer.trim(),
    });

    // 5. Check time limits
    const now = new Date();
    const elapsedTimeSeconds = (now.getTime() - interview.startedAt.getTime()) / 1000;
    const maxTimeSeconds = interview.duration * 60;
    
    // If time is up, or we already asked max questions before this answer
    // Note: questionsAsked tracks questions *already asked*, so if questionsAsked >= questionCount, 
    // the user just answered the final question.
    if (elapsedTimeSeconds >= maxTimeSeconds || interview.questionsAsked >= interview.questionCount) {
      // Save the answer but don't generate a new question
      await interview.save();
      return res.status(200).json({
        success: true,
        data: {
          status: "ready_to_complete",
          message: "Interview limit reached (time or questions). Ready for completion.",
        }
      });
    }

    // 6. Generate Next Question via Gemini
    let nextQData;
    let attempts = 0;
    const maxAttempts = 2; // Try once, retry once if duplicate

    // Extract previous questions for duplicate checking
    const previousQuestions = interview.conversation
      .filter(msg => msg.role === "interviewer")
      .map(msg => normalizeQuestion(msg.text));

    while (attempts < maxAttempts) {
      try {
        attempts++;
        nextQData = await generateNextQuestion({
          resume: interview.resume,
          role: interview.role,
          difficulty: interview.difficulty,
          questionCount: interview.questionCount,
          questionsAsked: interview.questionsAsked,
          conversation: interview.conversation,
        });

        // Duplicate Check
        const normalizedNew = normalizeQuestion(nextQData.question);
        if (previousQuestions.includes(normalizedNew)) {
          if (attempts >= maxAttempts) {
            throw new Error("Failed to generate a non-duplicate question after max retries");
          }
          continue; // Try again
        }
        
        break; // Success!
      } catch (err) {
        console.error(`Gemini next question error (attempt ${attempts}):`, err.message);
        if (attempts >= maxAttempts) {
          return res.status(502).json({
            success: false,
            message: "Unable to generate next interview question",
          });
        }
      }
    }

    // 7. Save generated question
    interview.conversation.push({
      role: "interviewer",
      text: nextQData.question,
      topic: nextQData.topic,
      difficulty: nextQData.difficulty,
    });
    
    interview.questionsAsked += 1;
    await interview.save();

    // 8. Return response
    return res.status(200).json({
      success: true,
      data: {
        question: {
          text: nextQData.question,
          topic: nextQData.topic,
          difficulty: nextQData.difficulty,
        },
        questionsAsked: interview.questionsAsked,
        remainingQuestions: interview.questionCount - interview.questionsAsked,
        decision: nextQData.decision, // useful for frontend debugging/UI
      },
    });

  } catch (err) {
    console.error("Submit answer error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ─── POST /api/interviews/:id/complete ─────────────────────────────────────────
const completeInterview = async (req, res) => {
  try {
    const interviewId = req.params.id;
    const userId = req.user.userId;

    const interview = await Interview.findOne({ _id: interviewId, userId });
    if (!interview) {
      return res.status(404).json({ success: false, message: "Interview not found or unauthorized" });
    }

    if (interview.status === "completed" || interview.status === "cancelled") {
      return res.status(400).json({ success: false, message: "Interview is already ended" });
    }

    if (interview.conversation.length === 0) {
      return res.status(400).json({ success: false, message: "No conversation to evaluate" });
    }

    // Call Gemini BEFORE saving status to DB to avoid inconsistent state on failure
    let feedback;
    try {
      feedback = await generateInterviewFeedback({
        resume: interview.resume,
        role: interview.role,
        difficulty: interview.difficulty,
        questionCount: interview.questionCount,
        status: "completed",
        conversation: interview.conversation,
      });
    } catch (err) {
      console.error("Gemini feedback error:", err.message);
      return res.status(502).json({ success: false, message: "Unable to generate feedback. Please try again." });
    }

    // Success! Update DB
    interview.status = "completed";
    interview.completedAt = new Date();
    interview.feedback = feedback;
    await interview.save();

    return res.status(200).json({
      success: true,
      message: "Interview completed successfully",
      data: {
        status: interview.status,
        feedback: interview.feedback,
      },
    });
  } catch (err) {
    console.error("Complete interview error:", err.message);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── POST /api/interviews/:id/cancel ───────────────────────────────────────────
const cancelInterview = async (req, res) => {
  try {
    const interviewId = req.params.id;
    const userId = req.user.userId;

    const interview = await Interview.findOne({ _id: interviewId, userId });
    if (!interview) {
      return res.status(404).json({ success: false, message: "Interview not found or unauthorized" });
    }

    if (interview.status === "completed" || interview.status === "cancelled") {
      return res.status(400).json({ success: false, message: "Interview is already ended" });
    }

    // Call Gemini BEFORE saving status to DB to avoid inconsistent state on failure
    let feedback;
    try {
      feedback = await generateInterviewFeedback({
        resume: interview.resume,
        role: interview.role,
        difficulty: interview.difficulty,
        questionCount: interview.questionCount,
        status: "cancelled",
        conversation: interview.conversation,
      });
    } catch (err) {
      console.error("Gemini feedback error:", err.message);
      return res.status(502).json({ success: false, message: "Unable to generate feedback. Please try again." });
    }

    // Success! Update DB
    interview.status = "cancelled";
    interview.cancelledAt = new Date();
    interview.feedback = feedback;
    await interview.save();

    return res.status(200).json({
      success: true,
      message: "Interview cancelled",
      data: {
        status: interview.status,
        feedback: interview.feedback,
      },
    });
  } catch (err) {
    console.error("Cancel interview error:", err.message);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

module.exports = { createInterview, submitAnswer, completeInterview, cancelInterview };
