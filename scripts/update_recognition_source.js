/**
 * Migration script to update recognition documents with recognitionSource field
 * 
 * This script:
 * 1. Connects to the local MongoDB "test" database
 * 2. Loops through all documents in recognition and goldenRecognition collections
 * 3. Adds the recognitionSource field to each document
 * 4. Sets the field to "initial" for the first occurrence of a message
 * 5. Sets the field to "reaction" for subsequent occurrences of the same message
 */

const { MongoClient } = require('mongodb');

// Connection URL and database name
const url = 'mongodb://localhost:27017';
const dbName = 'test';

// Track messages we've seen
const seenMessages = new Map();

async function updateRecognitionSource() {
  let client;

  try {
    // Connect to MongoDB
    client = new MongoClient(url);
    await client.connect();
    console.log('Connected to MongoDB server');

    const db = client.db(dbName);
    
    // Get collections
    const recognitionCollection = db.collection('recognition');
    const goldenRecognitionCollection = db.collection('goldenRecognition');
    
    // Process regular recognitions
    await processCollection(recognitionCollection, 'recognition');
    
    // Process golden recognitions
    await processCollection(goldenRecognitionCollection, 'goldenRecognition');
    
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    if (client) {
      await client.close();
      console.log('MongoDB connection closed');
    }
  }
}

async function processCollection(collection, collectionName) {
  // Get all documents
  const documents = await collection.find({}).toArray();
  console.log(`Found ${documents.length} documents in ${collectionName} collection`);
  
  let initialCount = 0;
  let reactionCount = 0;
  let alreadyUpdatedCount = 0;
  
  // Sort documents by timestamp (oldest first) to ensure proper initial/reaction assignment
  documents.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  
  // Process each document
  for (const doc of documents) {
    // Skip if already has recognitionSource field
    if (doc.recognitionSource) {
      alreadyUpdatedCount++;
      continue;
    }
    
    // Create a unique key for the message: recognizer + recognizee + message
    const messageKey = `${doc.recognizer}_${doc.recognizee}_${doc.message}`;
    
    // Determine if this is the first time we've seen this message
    let recognitionSource;
    if (seenMessages.has(messageKey)) {
      recognitionSource = 'reaction';
      reactionCount++;
    } else {
      recognitionSource = 'initial';
      initialCount++;
      seenMessages.set(messageKey, true);
    }
    
    // Update the document with the new field
    await collection.updateOne(
      { _id: doc._id },
      { $set: { recognitionSource: recognitionSource } }
    );
  }
  
  console.log(`${collectionName} collection update summary:`);
  console.log(`- ${initialCount} documents marked as "initial"`);
  console.log(`- ${reactionCount} documents marked as "reaction"`);
  console.log(`- ${alreadyUpdatedCount} documents already had recognitionSource field`);
}

// Run the migration
updateRecognitionSource()
  .then(() => console.log('Script execution completed'))
  .catch(err => console.error('Script execution failed:', err));
