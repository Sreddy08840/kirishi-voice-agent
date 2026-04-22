const fs = require('fs');
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

/**
 * Converts audio file to text using Groq's Whisper API
 * @param {string} audioFilePath - The path to the local audio file
 * @returns {Promise<string>} The transcribed text
 */
async function transcribeAudio(audioFilePath) {
  try {
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(audioFilePath),
      model: "whisper-large-v3-turbo",
      language: "hi", // Assuming Hindi as the primary language
    });
    
    return transcription.text;
  } catch (error) {
    console.error("Error transcribing audio:", error);
    throw error;
  }
}

module.exports = {
  transcribeAudio
};
