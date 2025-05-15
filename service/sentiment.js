const winston = require("winston");

// Defer loading ONNX runtime until we have a model
let ort;
let session;

// Clean text by removing special characters, URLs, and extra whitespace
function cleanText(text) {
  // Remove URLs
  text = text.replace(/https?:\/\/\S+/g, '');
  
  // Remove Slack user mentions
  text = text.replace(/<@[A-Z0-9]+>/g, '');
  
  // Remove Slack channel mentions
  text = text.replace(/<#[A-Z0-9]+>/g, '');
  
  // Remove Slack emojis
  text = text.replace(/:[a-z0-9_+-]+:/g, '');
  
  // Remove extra whitespace
  text = text.replace(/\s+/g, ' ').trim();
  
  return text;
}

async function initModel() {
  try {
    // Only load ONNX runtime when needed
    if (!ort) {
      ort = require("onnxruntime-node");
    }

    if (!session) {
      session = await ort.InferenceSession.create("./models/sentiment.onnx");
      winston.info("Sentiment analysis model loaded successfully", {
        func: "service.sentiment.initModel"
      });
    }
  } catch (error) {
    winston.error("Failed to load sentiment model", {
      error: error.message,
      func: "service.sentiment.initModel",
    });
    // Return false to indicate model loading failed
    return false;
  }
  return true;
}

async function analyzeSentiment(text) {
  // If model initialization fails, return N/A
  if (!session && !(await initModel())) {
    return ["N/A"];
  }

  try {
    // Clean and preprocess the text
    const cleanedText = cleanText(text);

    winston.info("Analyzing sentiment for text", {
      func: "service.sentiment.analyzeSentiment",
      originalLength: text.length,
      cleanedLength: cleanedText.length,
      originalText: text.substring(0, 100),
      cleanedText: cleanedText.substring(0, 100)
    });

    // TODO: Add your model-specific preprocessing here
    // This should be updated based on your ONNX model's input requirements
    const input = {
      // Example: if your model expects a 'text' input:
      // text: new ort.Tensor('string', [cleanedText], [1])
    };

    const results = await session.run(input);
    
    winston.info("Sentiment analysis results", {
      func: "service.sentiment.analyzeSentiment",
      results: results
    });

    // TODO: Add your model-specific post-processing here
    // Process the results based on your model's output format
    // Return the top sentiment(s)
    return ["positive"]; // Placeholder - replace with actual implementation

  } catch (error) {
    winston.error("Failed to analyze sentiment", {
      func: "service.sentiment.analyzeSentiment",
      error: error.message,
      text: text.substring(0, 100)
    });
    return ["N/A"];
  }
}

module.exports = {
  analyzeSentiment,
  initModel,
};
