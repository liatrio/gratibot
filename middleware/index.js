function directMessage() {
  return async ({ message, next }) => {
    if (message.channel_type === "im") {
      await next();
    }
  };
}

function anyOf(...funcs) {
  return async (input) => {
    let anyPassed = false;
    let i = 0;
    const next = input.next;
    input.next = () => anyPassed = true;
    while (!anyPassed && i < funcs.length) {
      await funcs[i](input);
      i++;
    }
    if (anyPassed) {
      await next();
    }
  }
}

function reactionMatches(emoji) {
  return async({ event, next }) => {
    if (emoji[0] == ":" && emoji[emoji.length - 1] == ":") {
      emoji = emoji.slice(1, -1);
    }
    if (event.reaction.includes(emoji)) {
      await next();
    }
  }
}


module.exports = {
  directMessage,
  anyOf,
  reactionMatches,
}
