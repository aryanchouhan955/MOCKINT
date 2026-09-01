const { Readable } = require('stream');

const textToSpeech = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ success: false, message: 'Valid text is required' });
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      console.warn('ELEVENLABS_API_KEY is not configured');
      return res.status(500).json({ success: false, message: 'TTS is not configured on the server' });
    }

    // Default voice ID (e.g. Rachel or arbitrary voice)
    const voiceId = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'; 

    // ElevenLabs API call
    // Use output_format=mp3_44100_128 to ensure consistent browser playback
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_flash_v2_5'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs API Error:', response.status, errorText);
      // Return 502 Bad Gateway to prevent client-side JWT auto-logout on 401
      const statusCode = (response.status === 401 || response.status === 403) ? 502 : response.status;
      return res.status(statusCode).json({ success: false, message: 'ElevenLabs API Error' });
    }

    // Pipe the audio stream back to the client
    res.setHeader('Content-Type', 'audio/mpeg');
    if (response.body) {
      Readable.fromWeb(response.body).pipe(res);
    } else {
      res.status(500).json({ success: false, message: 'Empty audio stream' });
    }
  } catch (error) {
    console.error('TTS error:', error.message);
    res.status(500).json({ success: false, message: 'Internal server error during TTS' });
  }
};

module.exports = { textToSpeech };
