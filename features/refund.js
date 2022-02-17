// Refund a redemption. This will delete the deduction of the associated ID
// Ex: @gratibot refund DEDUCTION_ID
// only redemption admins can execute this command
const winston = require("../winston");
const { directMention } = require("@slack/bolt");
const { anyOf, directMessage } = require("../middleware");
const deduction = require("../service/deduction");

module.exports = function (app) {
  app.message(                                                                                                                         
    "refund",                                                                                                                          
    anyOf(directMention(), directMessage()),                                                                                           
    respondToRefund
  );
};

async function respondToRefund({ message, client }) {                                                                                  
  winston.info("@gratibot refund Called", {                                                                                            
    callingUser: message.user,                                                                                                         
    slackMessage: message.text,                                                                                                        
  });                                                                                                                                  
  // Only redemption admins can call this
  const messageText = message.text.split(' ');
  await deduction.removeDeduction(messageText[2]);                                                                   

  await client.chat.postMessage({                                                                                                    
    channel: message.channel,                                                                                                          
    user: message.user,                                                                                                                
    text: "Refund Successfully given",                                                                                                          
  });                                                                                                                                  
}                                                                                                                                      
