class SlackError extends Error {
  
  constructor (apiMethod, apiError, userMessage, message) {
    super(message);

    this.apiMethod = apiMethod;
    this.apiError = apiError;
    this.userMessage = userMessage;
  }
}

class GratitudeError extends Error {

  constructor (gratitudeErrors, message) {
    super(message);

    this.gratitudeErrors = gratitudeErrors;
  }
}

module.exports = {
  SlackError,
  GratitudeError
}
