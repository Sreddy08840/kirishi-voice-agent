const express = require('express');
const router = express.Router();
const { handleVapiWebhook } = require('../vapi/vapiHandler');

const { processFarmerQuery } = require('../services/ragService');

// Endpoint that Vapi will call to get custom responses or tools
router.post('/webhook', handleVapiWebhook);

// Simple chat endpoint for Browser Demo
router.post('/chat', async (req, res) => {
    try {
        const { text, language } = req.body;
        if (!text) return res.status(400).json({ error: "Missing text" });
        
        const sessionId = req.ip || "browser-demo-session";
        const aiResponse = await processFarmerQuery(text, sessionId, language);
        res.json({ response: aiResponse });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Server error" });
    }
});

module.exports = router;
