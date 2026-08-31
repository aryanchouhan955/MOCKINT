require("dotenv").config({ override: true });
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
const port = process.env.PORT || 5000;

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.CLIENT_URL || "*" }));
app.use(express.json());

// ─── Database Connection ───────────────────────────────────────────────────────
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ Connected to MongoDB Atlas"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  });

// ─── Routes ───────────────────────────────────────────────────────────────────
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const interviewRoutes = require("./routes/interviewRoutes");

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/interviews", interviewRoutes);

// Health check
app.get("/", (req, res) => {
  res.json({ message: "AI Interviewer API is running" });
});

// ─── Start Server ──────────────────────────────────────────────────────────────
app.listen(port, () => {
  console.log(`🚀 Server listening at http://localhost:${port}`);
});
