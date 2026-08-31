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

module.exports = { generateFirstQuestion };