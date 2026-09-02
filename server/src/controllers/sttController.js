const { ElevenLabsClient } = require('@elevenlabs/elevenlabs-js');

// ─── GET /api/stt/token ────────────────────────────────────────────────────
// Issues a short-lived, single-use ElevenLabs realtime Scribe token so the
// browser can open a live STT WebSocket session without ever seeing the
// real ELEVENLABS_API_KEY. Tokens expire after 15 minutes and are consumed
// on first use, so we mint a fresh one on every "Start Voice Answer" click
// rather than caching it.
const getSTTToken = async (req, res) => {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      console.warn('ELEVENLABS_API_KEY is not configured');
      return res.status(500).json({
        success: false,
        message: 'Voice answering is not configured on the server',
      });
    }

    const elevenlabs = new ElevenLabsClient({ apiKey });
    const tokenResponse = await elevenlabs.tokens.singleUse.create('realtime_scribe');

    if (!tokenResponse?.token) {
      console.error('ElevenLabs token response missing token field:', tokenResponse);
      return res.status(502).json({
        success: false,
        message: 'Failed to obtain a voice-answer token',
      });
    }

    return res.json({ success: true, token: tokenResponse.token });
  } catch (error) {
    console.error('STT token error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while starting voice answering',
    });
  }
};

module.exports = { getSTTToken };
