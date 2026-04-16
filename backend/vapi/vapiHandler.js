const { processFarmerQuery } = require('../services/ragService');

/**
 * Handles incoming webhooks from Vapi.
 */
async function handleVapiWebhook(req, res) {
  try {
    const payload = req.body;
    
    // Attempt to extract text/transcript based on common Vapi shapes or custom payloads
    let userText = "";
    
    // Depending on what part of the Vapi lifecycle this hook is used for,
    // the transcript could be nested differently. We check a sequence of common fields.
    if (payload.transcript) {
        userText = payload.transcript;
    } else if (payload.message && payload.message.content) {
        userText = payload.message.content;
    } else if (payload.message && payload.message.transcript) {
        userText = payload.message.transcript;
    } else if (payload.text) {
        userText = payload.text;
    }

    if (!userText || userText.trim() === '') {
        // If it's a connection test or start of session
        return res.json({ 
            text: "Hello! Krishi AI is connected.", 
            end_session: false 
        });
    }

    // 1. Log the farmer's raw conversation input
    console.log(`[Call Log] Farmer: ${userText}`);

    // Map the unique session ID of the caller to gracefully isolate memory blocks
    const sessionId = payload?.message?.call?.id || payload?.call?.id || "vapi-anonymous-session";

    // 2. Send query through our complete RAG orchestration service
    const aiResponse = await processFarmerQuery(userText, sessionId);
    
    // 3. Log the AI's response text
    console.log(`[Call Log] Krishi AI: ${aiResponse}`);
    console.log("-----------------------------------------");

    // 4. Return exact JSON structure requested
    return res.json({
      text: aiResponse,
      end_session: false
    });

  } catch (error) {
    console.error("Error in Vapi webhook handler:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

module.exports = {
  handleVapiWebhook
};
