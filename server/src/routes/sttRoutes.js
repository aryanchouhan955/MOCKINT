const express = require('express');
const { getSTTToken } = require('../controllers/sttController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// GET /api/stt/token — issue a short-lived ElevenLabs realtime STT token
// for the authenticated user. Requested fresh every time voice answering
// starts (tokens are single-use and expire after 15 minutes).
router.get('/token', authMiddleware, getSTTToken);

module.exports = router;
