require('dotenv').config();

exports.getConfig = function getConfig() {
    return {
        slackBaseUrl: 'https://gratibot-lab.slack.com',
        gratibot: {
            username: '@alexa-gratibot-2',
            botToken: process.env.BOT_USER_OAUTH_ACCESS_TOKEN,
            appToken: process.env.APP_TOKEN,
            recognitionEmoji: ':fistbump:',
            recognitionLimit: 5,
        },
        users: {
            sender: {
                id: 'U04TFHAU3A7',
                email: process.env.SLACK_USERNAME,
                username: '@alex2',
                password: process.env.SLACK_PASSWORD,
                storageState: 'playwright/.auth/sender.json',
            },
            receiver: {
                username: '@Guz',
            },
        },
    }
}