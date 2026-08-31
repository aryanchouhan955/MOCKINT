const mongoose = require("mongoose");

// ─── Conversation Message Sub-Schema ──────────────────────────────────────────
// Each entry in the conversation array follows this shape.
// For now only "interviewer" messages are added (Chunk 2).
// "candidate" messages will be added in Chunk 3.
const MessageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["interviewer", "candidate"],
      required: true,
    },
    text: {
      type: String,
      required: true,
    },
    topic: {
      type: String,
      default: "general",
    },
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
    },
  },
  {
    timestamps: true, // each message gets createdAt
    _id: false,       // no separate _id for sub-documents
  }
);

// ─── Interview Schema ──────────────────────────────────────────────────────────
const InterviewSchema = new mongoose.Schema(
  {
    // Owner — comes from JWT, never from request body
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Input fields
    resume: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      required: true,
    },
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      required: true,
    },
    questionCount: {
      type: Number,
      required: true,
      min: 1,
      max: 20,
    },
    duration: {
      type: Number, // in minutes
      required: true,
      min: 1,
      max: 120,
    },

    // State
    status: {
      type: String,
      enum: ["created", "in_progress", "completed", "cancelled"],
      default: "created",
    },
    questionsAsked: {
      type: Number,
      default: 0,
    },

    // Conversation history
    conversation: {
      type: [MessageSchema],
      default: [],
    },

    // Feedback — structured JSON evaluation from Gemini
    feedback: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    // Timestamps for interview lifecycle
    startedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true, // adds createdAt and updatedAt
  }
);

module.exports = mongoose.model("Interview", InterviewSchema);
