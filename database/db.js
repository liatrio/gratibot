const { mongo_url } = require('../config')

const monk = require('monk')

module.exports = monk(mongo_url)
