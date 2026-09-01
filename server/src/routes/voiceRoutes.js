const express = require('express');
const fetch = require('node-fetch'); // we'll use native fetch below
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/stt-token', authMiddleware, async (req, res) => {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      console.warn('ELEVENLABS_API_KEY is not configured');
      return res.status(500).json({ success: false, message: 'Voice services are not configured' });
    }

    // ElevenLabs API to get a single-use token for realtime scribe
    const response = await fetch('https://api.elevenlabs.io/v1/single-use-token/realtime_scribe', {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs Token Error:', response.status, errorText);
      const statusCode = (response.status === 401 || response.status === 403) ? 502 : response.status;
      return res.status(statusCode).json({ success: false, message: 'Failed to generate token' });
    }

    const data = await response.json();
    return res.json({ success: true, token: data.token || data.single_use_token });
  } catch (error) {
    console.error('STT Token error:', error.message);
    res.status(500).json({ success: false, message: 'Internal server error generating voice token' });
  }
});

module.exports = router;
