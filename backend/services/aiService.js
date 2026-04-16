const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "dummy_key");

async function generateEmbedding(text) {
  try {
    // Using the official embedding model dynamically available to the user's specific Key scope
    const finalModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
    const result = await finalModel.embedContent(text);
    
    // Slice down strictly to 1536 dimensions requested previously for the Qdrant DB collection mapping constraint
    return result.embedding.values.slice(0, 1536);
  } catch (error) {
    console.error("Error generating embedding:", error);
    // Return dummy embedding or throw depending on need
    throw error;
  }
}

async function generateFarmingAdvice(query, contextData = [], memoryData = []) {
  try {
    // Construct the context string from Qdrant search results
    const contextText = contextData.map(item => item.payload?.text || "").join('\n');
    const memoryText = memoryData.map(item => item.payload?.text || "").join('\n');
    
    const prompt = `
You are "Krishi Voice AI", an expert agricultural assistant.
Based on the provided context, answer the farmer's question.

Rules for your answer:
- Determine if the user is asking in English, Kannada, or Hindi, and respond in that exact language.
- Provide short, clear, and farmer-friendly answers.
- Use simple terms that are easy to speak out loud over a voice call.

Recent Chat History (Conversation Memory):
${memoryText}

Knowledge Base (Facts):
${contextText}

Question:
${query}
`;

    // Escaping rate limits entirely by migrating conversational parsing dynamically to Groq's Lightning Fast Llama 3.3!
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }]
      })
    });
    
    const data = await response.json();
    
    if (!data.choices) {
        console.error("[Groq API Error]:", JSON.stringify(data, null, 2));
        return "Groq Server Error. Please check terminal logs.";
    }
    
    return data.choices[0].message.content;
  } catch (error) {
    console.error("Error generating AI response via Groq:", error);
    return "Maaf kijiye, mujhe abhi samajh nahi aaya. Kripaya baad mein try karein.";
  }
}

module.exports = {
  generateEmbedding,
  generateFarmingAdvice
};
