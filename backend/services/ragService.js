const { searchData, getRecentMemory, insertMemory } = require('../qdrant/db');
const { generateFarmingAdvice } = require('./aiService');

/**
 * Service that orchestrates the full RAG pipeline for the farmer's queries.
 */
async function processFarmerQuery(query, sessionId = "default-session", language = "hi-IN") {
  try {
    // Step 2 & 3: generate embedding and search Qdrant for top 3 results
    const contextResults = await searchData(query, 3);
    
    // Fetch last 3 conversations dynamically based on isolated session ID
    const memoryResults = await getRecentMemory(sessionId, 3);
    
    // Step 4: Sends query + context + memory to Gemini natively
    const answer = await generateFarmingAdvice(query, contextResults, memoryResults, language);

    // Save strictly the User Query specifically backwards into memory for next turn
    await insertMemory(sessionId, query);

    return answer;
  } catch (error) {
    console.error("Error in AI pipeline processFarmerQuery:", error);
    return "Something went wrong. Please try again.";
  }
}

module.exports = {
  processFarmerQuery
};
