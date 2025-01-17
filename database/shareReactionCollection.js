const db = require('./db')
const shareReactionCollection = db.get('share_reactions')

// Create indexes for efficient querying
shareReactionCollection.createIndex('messageTs')
shareReactionCollection.createIndex('userId')
shareReactionCollection.createIndex({ 'messageTs': 1, 'userId': 1 }, { unique: true })

module.exports = shareReactionCollection
