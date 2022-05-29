const db = require('./db')
const deductionCollection = db.get('deduction')

deductionCollection.createIndex('user')
deductionCollection.createIndex('timestamp')
deductionCollection.createIndex('refund')

module.exports = deductionCollection
