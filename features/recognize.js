const { emoji, maximum, minimumMessageLength } = require('../config')
const recognition = require('../service/recognition')

const userRegex = /<@([a-zA-Z0-9]+)>/g;
const tagRegex = /#(\S+)/g;

module.exports = function(controller) {
    controller.hears(emoji , ['direct_message', 'direct_mention', 'mention', /* 'message' */], async (bot, message) => {

        const recognizedUsers = extractUsers(message);
        if(recognizedUsers.length === 0) {
            await bot.replyEphemeral(
                message,
                'Forgetting something?  Try again...this time be sure to mention who you want to recognize with `@user`'
            )
            return
        }
        if(recognizedUsers.includes(message.user)) {
            await bot.replyEphemeral(
                message,
                'You aren\' allowed to recognize yourself.'
            )
            return
        }
        if(false) {
            await bot.replyEphemeral(
                message,
                `Giving ${emoji} requires a description greater than ${minimumMessageLength} characters. Please try again.`
            )
            return
        }
        const recognizedUsersIds = await Promise.all(recognizedUsers.map(async user => bot.api.users.info({user: user})))
        console.log(recognizedUsersIds);
        sendRecognition(message, recognizedUsersIds);

    });
}


function extractUsers(message) {
    const users = message.text.match(userRegex) || [];
    return users.map(user => user.slice(2, -1));
}

function isMessageProperLength(message) {
    const emojiRegex = new RegExp(emoji, 'g');
    const trimmedMessage = message.text.replace(/\s*<.*?>\s*/g, '').replace(emojiRegex, '');
    return trimmedMessage >= minimumMessageLength;
}

async function isRecognitionWithinSpendingLimits(message, recognizedUsersCount) {
    const emojiRegex = new RegExp(emoji, 'g');
    const emojiCount = (message.text.match(emojiRegex) || []).length;
    console.log(`User: ${message.user}`)
    const recognizerInfo = await bot.api.users.info({user: message.user});
    console.log(`UserId: ${recognizerInfo.id}`)
    const recognitionGivenToday = await recognition.countRecognitionGiven(recongnizerInfo.id, recognizerInfo.iz, 1);
    const recognitionInMessage = recognizedUsersCount * emojiCount
    return recognitionGivenToday + recognitionInMessage <= maximum || usersExemptFromMaximum.contains(recognizerInfo.id)
}

async function sendRecognition(message, recognizedUsersIds) {
    console.log('Recognition Sent')
    const tags = (message.text.match(tagRegex) || []).map(tag => tag.slice(1));
    const emojiRegex = new RegExp(emoji, 'g');
    const emojiCount = (message.text.match(emojiRegex) || []).length;
    for(let i = 0; i < recognizedUsersIds.length; i++) {
        for(let j = 0; j < emojiCount; j++) {
            recognition.giveRecognition(
                message.user,
                recognizedUsersIds[i].user.id,
                message.text,
                message.channel,
                tags
            )
        }
    }
}
