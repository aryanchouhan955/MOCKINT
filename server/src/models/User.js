const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,   // normalizes email before saving
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
    },
    // Future fields — not required for auth chunk
    targetRole: {
      type: String,
    },
    skills: {
      type: [String],
      default: [],
    },
    resume: {
      type: String,
    },
    // Encrypted Gemini API key — stored as "iv:encryptedHex" via encryption utility
    // Never stored or returned as plain text
    geminiApiKey: {
      type: String,
      default: null,
    },
    // User's preferred Gemini model — null means use the system default
    geminiModel: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true, // adds createdAt and updatedAt automatically
  }
);

module.exports = mongoose.model("User", UserSchema);