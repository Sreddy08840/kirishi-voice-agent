const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

/**
 * Downloads an audio file from a URL to a local temporary file.
 * @param {string} url - The URL of the audio file to download
 * @returns {Promise<string>} The path to the downloaded file
 */
async function downloadAudio(url) {
  try {
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream',
      // If the URL requires authentication (like Twilio recording URLs usually do if secure media is enabled),
      // you can pass Twilio credentials here via HTTP basic auth, but Twilio RecordingUrls 
      // are typically public by default unless specifically configured otherwise.
    });

    const tempDir = path.join(__dirname, '..', 'tmp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const filePath = path.join(tempDir, `${uuidv4()}.wav`);
    const writer = fs.createWriteStream(filePath);

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => resolve(filePath));
      writer.on('error', reject);
    });
  } catch (error) {
    console.error("Error downloading audio:", error);
    throw error;
  }
}

module.exports = {
  downloadAudio
};
