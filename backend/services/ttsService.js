const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = 'pNInz6obpgDQGcFmaJgB'; // Default ElevenLabs voice ID (Adam)

/**
 * Converts text to speech using ElevenLabs API and saves it as an MP3 file.
 * @param {string} text - The text to synthesize
 * @returns {Promise<string>} The filename of the generated audio file
 */
async function synthesizeSpeech(text) {
  if (!ELEVENLABS_API_KEY) {
    console.warn("No ElevenLabs API Key provided. Using fallback Twilio TTS mechanism.");
    return null;
  }

  try {
    const response = await axios({
      method: 'POST',
      url: `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      data: {
        text: text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        }
      },
      responseType: 'stream',
    });

    const fileName = `${uuidv4()}.mp3`;
    const publicAudioDir = path.join(__dirname, '..', 'public', 'audio');
    
    // Ensure the directory exists
    if (!fs.existsSync(publicAudioDir)) {
      fs.mkdirSync(publicAudioDir, { recursive: true });
    }

    const filePath = path.join(publicAudioDir, fileName);
    const writer = fs.createWriteStream(filePath);

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => resolve(fileName));
      writer.on('error', reject);
    });

  } catch (error) {
    console.error("Error synthesizing speech:", error);
    throw error;
  }
}

module.exports = {
  synthesizeSpeech
};
