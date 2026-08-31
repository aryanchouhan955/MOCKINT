require(process.cwd() + '/node_modules/dotenv').config({override:true});
const { GoogleGenAI } = require(process.cwd() + '/node_modules/@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const systemInstruction = 'You are an interviewer. Respond with JSON { "question": "...", "topic": "...", "difficulty": "..." }';
const userPrompt = 'Candidate Resume: I built an e-commerce app';

ai.models.generateContent({
  model: 'gemini-3.6-flash',
  contents: userPrompt,
  config: {
    systemInstruction,
    temperature: 0.7,
    maxOutputTokens: 300,
  }
}).then(res => console.log('RES:', res)).catch(console.error);
