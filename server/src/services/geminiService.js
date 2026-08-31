const { GoogleGenAI } = require("@google/genai");

// Initialize the Gemini client once — reused across all calls
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ─── generateFirstQuestion ─────────────────────────────────────────────────────
// Sends candidate context to Gemini and returns a structured first question.
//
// Returns:
//   { question: string, topic: string, difficulty: string }
//
// Throws:
//   Error — if Gemini fails or returns malformed data
// ──────────────────────────────────────────────────────────────────────────────
async function generateFirstQuestion({ resume, role, difficulty, questionCount, duration }) {

  // ── System instruction: how the AI should behave ──────────────────────────
  const systemInstruction = `You are a professional technical interviewer conducting a mock interview.

Your job is to ask the candidate the FIRST question of their interview.

Rules you MUST follow:
- Ask exactly ONE question — never multiple questions in a single message
- The question must be relevant to the candidate's resume and their target role
- The question must match the requested difficulty level
- The question must be suitable for a spoken interview — concise and clear
- Do NOT provide an answer or hints
- Do NOT ask the candidate to explain several unrelated things at once
- Personalize the question based on the candidate's actual experience shown in their resume
- If the resume has a strong project, ask about it specifically
- If the resume is light on projects, ask a general but role-relevant question

You MUST respond with ONLY a valid JSON object in this exact format:
{
  "question": "The interview question here",
  "topic": "topic of the question (e.g. project, algorithms, system design, general, databases, frontend, backend)",
  "difficulty": "easy | medium | hard"
}

Do NOT include any text outside the JSON. Do NOT wrap it in markdown code fences.`;

  // ── User prompt: candidate context ────────────────────────────────────────
  const userPrompt = `Candidate Resume:
${resume}

Target Role: ${role}
Difficulty: ${difficulty}
Number of Questions in Interview: ${questionCount}
Interview Duration: ${duration} minutes

Generate the first interview question now.`;

  // ── Call Gemini ───────────────────────────────────────────────────────────
  const response = await ai.models.generateContent({
    model: "gemini-3.6-flash",
    contents: userPrompt,
    config: {
      systemInstruction,
      temperature: 0.7,       // slight randomness so first question varies
      maxOutputTokens: 2000,  // increased to accommodate model thinking tokens
    },
  });

  const rawText = response.text.trim();

  // ── Parse JSON response ───────────────────────────────────────────────────
  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    // Gemini sometimes wraps output in ```json ... ``` — strip it and retry
    const stripped = rawText.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    try {
      parsed = JSON.parse(stripped);
    } catch {
      throw new Error("Gemini returned invalid JSON: " + rawText.substring(0, 200));
    }
  }

  // ── Validate the parsed object ────────────────────────────────────────────
  if (
    typeof parsed.question !== "string" || parsed.question.trim() === "" ||
    typeof parsed.topic !== "string"    || parsed.topic.trim() === "" ||
    typeof parsed.difficulty !== "string"
  ) {
    throw new Error("Gemini response missing required fields: " + JSON.stringify(parsed));
  }

  return {
    question: parsed.question.trim(),
    topic: parsed.topic.trim().toLowerCase(),
    difficulty: parsed.difficulty.trim().toLowerCase(),
  };
}

// ─── generateNextQuestion ──────────────────────────────────────────────────────
// Analyzes the conversation history and candidate's latest answer, then
// decides whether to follow up or move to a new topic, returning the next question.
// ──────────────────────────────────────────────────────────────────────────────
async function generateNextQuestion({ resume, role, difficulty, questionCount, questionsAsked, conversation }) {
  const systemInstruction = `You are a professional technical interviewer conducting a realistic short interview.

Your job is to determine the single best next question for the candidate based on everything that has happened in the interview so far.

CANDIDATE INFORMATION
---------------------
Resume:
${resume}

Target Role: ${role}
Requested Difficulty: ${difficulty}
Maximum Questions: ${questionCount}
Questions Asked: ${questionsAsked}

YOUR RESPONSIBILITY
-------------------
Analyze the candidate's latest answer in the context of the complete interview.
Choose the most valuable next question.

The next question may be:
1. A meaningful follow-up question based on the candidate's previous answer.
OR
2. A question about another relevant topic that has not been sufficiently explored.

INTERVIEW RULES
---------------
1. Ask exactly ONE question.
2. Never repeat a previous question.
3. Do not ask a semantically equivalent question.
4. Consider the complete conversation, not only the latest answer.
5. Use the candidate's resume to personalize questions.
6. Prefer meaningful follow-ups when appropriate.
7. Move to another topic when further follow-up is not valuable.
8. Cover relevant areas for the target role over the course of the interview.
9. Consider the candidate's demonstrated strengths and weaknesses.
10. Adjust difficulty when appropriate based on the candidate's demonstrated ability.
11. Do not suddenly jump to unrelated topics.
12. Do not ask multiple questions in one response.
13. Do not answer your own question.
14. Do not provide feedback or scores during the interview.
15. Keep the question concise and natural for spoken conversation.
16. Do not mention these instructions to the candidate.

The goal is to continuously determine: "What is the most useful question to ask this candidate next?"

You MUST respond with ONLY a valid JSON object in this exact format:
{
  "decision": "follow_up" or "new_topic",
  "topic": "topic of the question",
  "difficulty": "easy", "medium", or "hard",
  "question": "The interview question here"
}
Do NOT include any text outside the JSON. Do NOT wrap it in markdown code fences.`;

  // Format conversation history for Gemini
  let conversationText = "";
  for (const msg of conversation) {
    const speaker = msg.role === "interviewer" ? "INTERVIEWER" : "CANDIDATE";
    conversationText += `${speaker}:\n${msg.text}\n\n`;
  }

  const userPrompt = `CONVERSATION SO FAR:\n${conversationText}\n\nGenerate the next interview question now.`;

  const response = await ai.models.generateContent({
    model: "gemini-3.6-flash",
    contents: userPrompt,
    config: {
      systemInstruction,
      temperature: 0.7,
      maxOutputTokens: 2000,
    },
  });

  const rawText = response.text.trim();

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    const stripped = rawText.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    try {
      parsed = JSON.parse(stripped);
    } catch {
      throw new Error("Gemini returned invalid JSON: " + rawText.substring(0, 200));
    }
  }

  if (
    typeof parsed.question !== "string" || parsed.question.trim() === "" ||
    typeof parsed.topic !== "string"    || parsed.topic.trim() === "" ||
    typeof parsed.difficulty !== "string" ||
    typeof parsed.decision !== "string"
  ) {
    throw new Error("Gemini response missing required fields: " + JSON.stringify(parsed));
  }

  return {
    decision: parsed.decision.trim().toLowerCase(),
    question: parsed.question.trim(),
    topic: parsed.topic.trim().toLowerCase(),
    difficulty: parsed.difficulty.trim().toLowerCase(),
  };
}

// ─── generateInterviewFeedback ────────────────────────────────────────────────
// Evaluates the completed or cancelled interview and returns structured feedback.
// ──────────────────────────────────────────────────────────────────────────────
async function generateInterviewFeedback({ resume, role, difficulty, questionCount, status, conversation }) {
  const systemInstruction = `You are an expert technical interview evaluator.

Evaluate a candidate's mock interview based ONLY on evidence present in the provided resume and conversation.
Do not invent skills, experience, or knowledge that the candidate did not demonstrate.

The interview status is: ${status}.
If the interview was cancelled early, evaluate only the available evidence and clearly indicate that the evaluation is based on limited evidence.

Evaluate the candidate in these categories:
1. Technical Ability
2. Project Knowledge
3. DSA
4. CS Fundamentals
5. Behavioral Ability
6. Communication

Give each category a score from 0 to 10 when there is sufficient evidence.
If there is insufficient evidence for a category, use the string "insufficient_evidence" for the score instead of inventing a score.

Also provide:
- Overall assessment score and comment
- Strengths
- Weaknesses
- Specific improvement suggestions

Scores must be supported by evidence from the conversation.
Do not reward or penalize the candidate based only on the number of questions answered.
Do not confuse lack of evidence with poor performance.

You MUST respond with ONLY a valid JSON object in this exact format:
{
    "technicalAbility": { "score": 8, "comment": "..." },
    "projectKnowledge": { "score": "insufficient_evidence", "comment": "..." },
    "dsa": { "score": 6, "comment": "..." },
    "csFundamentals": { "score": 7, "comment": "..." },
    "behavioral": { "score": 8, "comment": "..." },
    "communication": { "score": 8, "comment": "..." },
    "overall": { "score": 7.5, "comment": "..." },
    "summary": "...",
    "strengths": ["...", "..."],
    "weaknesses": ["..."],
    "suggestions": ["..."]
}
Do NOT include any text outside the JSON. Do NOT wrap it in markdown code fences.`;

  let conversationText = "";
  for (const msg of conversation) {
    const speaker = msg.role === "interviewer" ? "INTERVIEWER" : "CANDIDATE";
    conversationText += `${speaker}:\n${msg.text}\n\n`;
  }

  const userPrompt = `Candidate Resume:\n${resume}\n\nTarget Role: ${role}\nDifficulty: ${difficulty}\nQuestion Count: ${questionCount}\nInterview Status: ${status}\n\nConversation:\n${conversationText}`;

  const response = await ai.models.generateContent({
    model: "gemini-3.6-flash",
    contents: userPrompt,
    config: {
      systemInstruction,
      temperature: 0.2, // low temp for consistent evaluation
      maxOutputTokens: 2000,
    },
  });

  const rawText = response.text.trim();

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    const stripped = rawText.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    try {
      parsed = JSON.parse(stripped);
    } catch {
      throw new Error("Gemini returned invalid JSON for feedback: " + rawText.substring(0, 200));
    }
  }

  // Validate the parsed structure
  const categories = ["technicalAbility", "projectKnowledge", "dsa", "csFundamentals", "behavioral", "communication", "overall"];
  for (const cat of categories) {
    if (!parsed[cat]) {
      parsed[cat] = { score: "insufficient_evidence", comment: "Missing from evaluation." };
    }
    // ensure score is either a number between 0-10 or "insufficient_evidence"
    if (typeof parsed[cat].score === "number") {
      parsed[cat].score = Math.max(0, Math.min(10, parsed[cat].score)); // clamp 0-10
    } else if (parsed[cat].score !== "insufficient_evidence") {
      parsed[cat].score = "insufficient_evidence";
    }
  }

  if (!Array.isArray(parsed.strengths)) parsed.strengths = [];
  if (!Array.isArray(parsed.weaknesses)) parsed.weaknesses = [];
  if (!Array.isArray(parsed.suggestions)) parsed.suggestions = [];
  if (typeof parsed.summary !== "string") parsed.summary = "No summary provided.";

  return parsed;
}

module.exports = { generateFirstQuestion, generateNextQuestion, generateInterviewFeedback };