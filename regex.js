var regex = {};
var _ = require("lodash");

regex.userRegex = /<@([^>]+)>/;
regex.deductRegex = /<@([^|>]+)\|/; // For Slash command
regex.groupRegex = /<!subteam\^([a-zA-Z0-9]+)\|@([a-zA-Z0-9]+)>/g;
regex.tagRegex = /#(\S+)/g;
regex.generalEmojiRegex = /:([a-z-_']+):/g;

module.exports = regex;