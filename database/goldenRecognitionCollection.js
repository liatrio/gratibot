const db = require('./db')
const goldenRecognitionCollection = db.get('goldenrecognition')

goldenRecognitionCollection.createIndex('recognizer')
goldenRecognitionCollection.createIndex('recognizee')
goldenRecognitionCollection.createIndex('timestamp')

module.exports = goldenRecognitionCollection
