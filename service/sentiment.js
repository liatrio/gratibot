const winston = require("../winston");
const axios = require("axios");

const CLASSIFIER_URL = process.env.CLASSIFIER_URL || 'http://localhost:8000';

// Clean text by removing special characters, URLs, and extra whitespace
function cleanText(text) {
  // Remove user mentions
  text = text.replace(/<@[A-Z0-9]+>/g, "");

  // Remove emoji codes
  text = text.replace(/:[a-z_]+:/g, "");

  // Remove URLs
  text = text.replace(/https?:\/\/\S+/g, "");

  // Normalize whitespace
  text = text.replace(/\s+/g, " ").trim();

  return text;
}

async function analyzeSentiment(text) {
  try {
    winston.info("Analyzing message principles", {
      func: "service.sentiment.analyzeSentiment",
      text: text.substring(0, 100)
    });

    // Clean the text
    const cleanedText = cleanText(text);
    winston.debug("Cleaned text", {
      func: "service.sentiment.analyzeSentiment",
      originalText: text.substring(0, 100),
      cleanedText: cleanedText
    });

    // Call the classification API
    const response = await axios.post(`${CLASSIFIER_URL}/classify`, {
      message: cleanedText
    });

    winston.info("Principle classification results", {
      func: "service.sentiment.analyzeSentiment",
      principle: response.data.principle,
      confidence: response.data.confidence,
      probabilities: response.data.probabilities
    });

    // Return the principle as a value
    return [response.data.principle];

  } catch (error) {
    winston.error("Failed to analyze message", {
      func: "service.sentiment.analyzeSentiment",
      error: error.message,
      text: text.substring(0, 100)
    });
    return ["N/A"];
  }
}

module.exports = {
  analyzeSentiment
};
