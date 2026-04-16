const { QdrantClient } = require('@qdrant/js-client-rest');
const crypto = require('crypto');
const { generateEmbedding } = require('../services/aiService');

const qdrantClient = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY
});

// Using agreed upon collection name
const COLLECTION_NAME = "agri_kb";

async function initDB() {
  try {
    if (!process.env.QDRANT_URL) {
      console.log("QDRANT_URL is not set. Skipping Qdrant setup.");
      return;
    }
    
    const result = await qdrantClient.getCollections();
    const exists = result.collections.some(c => c.name === COLLECTION_NAME);
    
    if (!exists) {
      // User explicitly requested 1536 dimensions
      await qdrantClient.createCollection(COLLECTION_NAME, {
        vectors: { size: 1536, distance: "Cosine" } 
      });
      console.log(`Collection ${COLLECTION_NAME} created successfully.`);
      
      // Explicitly Create payload indexes mandated by Cloud filters to discriminate memory vs core knowledge
      await qdrantClient.createPayloadIndex(COLLECTION_NAME, {
        field_name: "type",
        field_schema: "keyword",
        wait: true
      });
      await qdrantClient.createPayloadIndex(COLLECTION_NAME, {
        field_name: "sessionId",
        field_schema: "keyword",
        wait: true
      });
      console.log(`Indexes created dynamically on ${COLLECTION_NAME}.`);
    } else {
      console.log(`Collection ${COLLECTION_NAME} already exists.`);
      // Enforce the payload indexes anyway for backwards compatibility against older collections
      try {
        await qdrantClient.createPayloadIndex(COLLECTION_NAME, {
          field_name: "type",
          field_schema: "keyword",
          wait: true
        });
        await qdrantClient.createPayloadIndex(COLLECTION_NAME, {
          field_name: "sessionId",
          field_schema: "keyword",
          wait: true
        });
        console.log(`Indexes enforced on pre-existing deployment.`);
      } catch (indexError) {
        // Silently pass if they were already created previously on the strict configuration
      }
    }
  } catch (error) {
    console.error("Error initializing Qdrant:", error);
  }
}

async function insertData(text, metadata) {
  try {
    if (!process.env.QDRANT_URL) return;
    
    const embedding = await generateEmbedding(text);
    const pointId = crypto.randomUUID();

    await qdrantClient.upsert(COLLECTION_NAME, {
      wait: true,
      points: [
        {
          id: pointId,
          vector: embedding,
          payload: {
            text: text,
            ...metadata
          }
        }
      ]
    });
    console.log(`Inserted data into Qdrant: ${metadata.title}`);
  } catch (error) {
    console.error("Error inserting data into Qdrant:", error);
  }
}

async function searchData(query, limit = 3) {
  try {
    if (!process.env.QDRANT_URL) return [];
    
    const queryEmbedding = await generateEmbedding(query);
    
    const searchResult = await qdrantClient.search(COLLECTION_NAME, {
      vector: queryEmbedding,
      limit: limit,
      with_payload: true,
      filter: {
        must_not: [{ key: "type", match: { value: "memory" } }]
      }
    });
    
    return searchResult;
  } catch (error) {
    console.error("Error searching in Qdrant:", error);
    return [];
  }
}

async function insertMemory(sessionId, query) {
  // Pushing chronological memory into our Vector Space mapped specifically to session
  await insertData(query, { type: "memory", sessionId, timestamp: Date.now(), title: "User History" });
}

async function getRecentMemory(sessionId, limit = 3) {
  try {
    if (!process.env.QDRANT_URL) return [];
    
    // Scroll to natively fetch documents explicitly isolated to the user's specific conversational thread
    const result = await qdrantClient.scroll(COLLECTION_NAME, {
      filter: {
        must: [
          { key: "type", match: { value: "memory" } },
          { key: "sessionId", match: { value: sessionId } }
        ]
      },
      limit: 10,
      with_payload: true
    });
    
    let points = result.points;
    // Sort strictly chronological, newest first to slice precisely the recent 3
    points.sort((a, b) => b.payload.timestamp - a.payload.timestamp);
    // Reverse again sequentially so the context window reads from oldest to newest predictably
    return points.slice(0, limit).reverse();
  } catch (error) {
    console.error("Error retrieving memory from Qdrant:", error);
    return [];
  }
}

// Function to seed sample agricultural data
async function seedSampleData() {
  console.log("Starting to seed sample agricultural data...");

  const samples = [
    {
      text: "PM Kisan Samman Nidhi (PM-KISAN) is a central sector scheme that provides an income support of ₹6,000 per year in three equal installments to all landholding farmer families.",
      metadata: { title: "PM Kisan Yojana", category: "Govt Scheme" }
    },
    {
      text: "Tomato Early Blight disease causes brown spots on leaves. Solution: Spray Copper Oxychloride (3g/litre) or Mancozeb (2g/litre). Do crop rotation and ensure proper spacing between plants.",
      metadata: { title: "Tomato disease solution", category: "Pest Management" }
    },
    {
      text: "Today's Mandi Prices: Wheat is trading at ₹2,200 to ₹2,450 per quintal. Rice (Paddy) is trading at ₹2,100 to ₹2,300 per quintal depending on the variety and moisture content.",
      metadata: { title: "Market price example", category: "Market Updates" }
    }
  ];

  for (const sample of samples) {
    await insertData(sample.text, sample.metadata);
  }
  
  console.log("Sample data seeding completed.");
}

module.exports = {
  qdrantClient,
  initDB,
  insertData,
  searchData,
  seedSampleData,
  insertMemory,
  getRecentMemory
};
