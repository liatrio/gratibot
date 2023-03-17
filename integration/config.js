exports.getConfig = function getConfig() {
    return {
        slackBaseUrl: "https://gratibot-lab.slack.com",
        gratibot: {
            username: "@alexa-gratibot-2",
        },
        users: {
            sender: {
                username: process.env.SLACK_USERNAME,
                password: process.env.SLACK_PASSWORD
            }
        }
    }
}