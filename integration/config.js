require('dotenv').config();

exports.getConfig = function getConfig() {
    return {
        slackBaseUrl: 'https://gratibot-lab.slack.com',
        gratibot: {
            username: '@alexa-gratibot-2',
            botToken: process.env.BOT_USER_OAUTH_ACCESS_TOKEN,
            appToken: process.env.APP_TOKEN,
            recognitionEmoji: ":fistbump:",
            recognitionLimit: 5
        },
        users: {
            sender: {
                id: "U04TFHAU3A7",
                username: process.env.SLACK_USERNAME,
                password: process.env.SLACK_PASSWORD,
            },
            receiver: {
                username: "@Guz"
            },
        },
    }
}