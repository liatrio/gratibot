var config = {}

config.emoji = process.env.EMOJI || ':fistbump:'
config.mongo_url = process.env.MONGO_URL || 'mongodb://mongodb:27017/gratibot'
config.maximum = 5
config.minimumMessageLength = 20

config.usersExemptFromMaximum = [
  'U037FL37G',
]
config.usersAllowedToDeduct = [

]

module.exports = config
