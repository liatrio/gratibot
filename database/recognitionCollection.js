const db = require('./db')
const recognitionCollection = db.get('recognition')

recognitionCollection.createIndex('recognizer')
recognitionCollection.createIndex('recognizee')
recognitionCollection.createIndex('timestamp')

module.exports = recognitionCollection
