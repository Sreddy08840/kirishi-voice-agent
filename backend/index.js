const express = require('express');
const cors = require('cors');
require('dotenv').config();

const apiRoutes = require('./routes/index');

const telephonyRoutes = require('./routes/telephony');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
// Required for Twilio webhooks which send form-urlencoded data
app.use(express.urlencoded({ extended: true }));
// Serve generated TTS audio files
app.use('/audio', express.static(require('path').join(__dirname, 'public', 'audio')));

// Routes
app.use('/vapi', apiRoutes);
app.use('/voice', telephonyRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Krishi Voice AI Backend is running' });
});

const { initDB } = require('./qdrant/db');

app.listen(PORT, async () => {
    await initDB();
    console.log(`Server is running on port ${PORT}`);
});
