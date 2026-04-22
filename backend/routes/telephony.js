const express = require('express');
const router = express.Router();
const fs = require('fs');
const { twiml } = require('twilio');
const { downloadAudio } = require('../utils/audioDownloader');
const { transcribeAudio } = require('../services/sttService');
const { synthesizeSpeech } = require('../services/ttsService');
const { processFarmerQuery } = require('../services/ragService');

// Webhook for incoming Twilio calls
router.post('/', (req, res) => {
    const response = new twiml.VoiceResponse();
    
    // Greet the user in Hindi
    response.say({ language: 'hi-IN' }, "Krishi AI me swagat hai, kripya apna sawal poochiye.");
    
    // Record user's speech
    response.record({
        action: '/voice/process',
        method: 'POST',
        maxLength: 30, // max length of user's query in seconds
        playBeep: true,
        transcribe: false // We use our own Whisper STT for better local language support
    });
    
    // If user doesn't say anything, hang up
    response.say({ language: 'hi-IN' }, "Aapne kuch nahi kaha. Call kat ki ja rahi hai.");
    response.hangup();

    res.type('text/xml');
    res.send(response.toString());
});

// Webhook for processing the recording
router.post('/process', async (req, res) => {
    const { RecordingUrl, From } = req.body;
    let localFilePath = null;
    const response = new twiml.VoiceResponse();

    try {
        if (!RecordingUrl) {
            throw new Error("No recording URL received from Twilio");
        }

        console.log(`[Telephony] Incoming recording from ${From}`);
        
        // 1. Download recording
        localFilePath = await downloadAudio(RecordingUrl);
        
        // 2. Transcribe recording with Whisper
        const transcribedText = await transcribeAudio(localFilePath);
        console.log(`[Telephony] Caller said: ${transcribedText}`);
        
        // If empty transcription, ask to repeat
        if (!transcribedText || transcribedText.trim() === '') {
            response.say({ language: 'hi-IN' }, "Maaf kijiye, main sun nahi paya. Kripya wapas bataiye.");
            response.record({ action: '/voice/process', method: 'POST' });
        } else {
            // 3. Process AI query (use caller's phone number as session ID)
            const aiAnswer = await processFarmerQuery(transcribedText, From);
            console.log(`[Telephony] AI Answer: ${aiAnswer}`);

            // 4. Generate TTS (ElevenLabs)
            const fileName = await synthesizeSpeech(aiAnswer);

            if (fileName) {
                // Play generated audio file
                const serverUrl = process.env.SERVER_URL || `${req.protocol}://${req.headers.host}`;
                response.play(`${serverUrl}/audio/${fileName}`);
            } else {
                // Fallback to Twilio's built-in TTS
                response.say({ language: 'hi-IN' }, aiAnswer);
            }

            // 5. Keep conversation looping
            response.say({ language: 'hi-IN' }, "Kya aapka koi aur sawal hai? Kripya bataiye.");
            response.record({
                action: '/voice/process',
                method: 'POST',
                maxLength: 30,
                playBeep: true
            });
        }
    } catch (error) {
        console.error("[Telephony] Error processing call:", error);
        response.say({ language: 'hi-IN' }, "Maaf kijiye, server mein kuch samasya aa gayi hai. Kripya baad mein try karein.");
        response.hangup();
    } finally {
        // Clean up the downloaded file
        if (localFilePath && fs.existsSync(localFilePath)) {
            try {
                fs.unlinkSync(localFilePath);
            } catch (cleanupError) {
                console.error("[Telephony] Error cleaning up file:", cleanupError);
            }
        }
    }

    res.type('text/xml');
    res.send(response.toString());
});

module.exports = router;
