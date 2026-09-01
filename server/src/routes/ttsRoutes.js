const express = require('express');
const { textToSpeech } = require('../controllers/ttsController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', authMiddleware, textToSpeech);

module.exports = router;
