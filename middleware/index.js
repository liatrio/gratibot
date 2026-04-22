async function directMessage({ message, next }) {
  if (message.channel_type === "im") {
    await next();
  }
}

/**
 * Composes Bolt middleware with OR semantics.
 * Returns a middleware that calls next() iff any of the provided middlewares
 * would have. Short-circuits on the first pass.
 */
function anyOf(...funcs) {
  // Swap-and-probe: replace Bolt's `next` with a flag setter so each child can
  // be asked "would you pass?" without actually advancing the chain.
  return async (input) => {
    let anyPassed = false;
    let i = 0;
    const next = input.next;
    input.next = () => (anyPassed = true);
    while (!anyPassed && i < funcs.length) {
      await funcs[i](input);
      i++;
    }
    if (anyPassed) {
      await next();
    }
  };
}

function reactionMatches(emoji) {
  if (emoji.startsWith(":") && emoji.endsWith(":")) {
    emoji = emoji.slice(1, -1);
  }
  // Substring match (not equality): Slack encodes skin-tone reactions by
  // suffixing the base name, e.g. "fistbump::skin-tone-2".
  return async ({ event, next }) => {
    if (event.reaction.includes(emoji)) {
      await next();
    }
  };
}

module.exports = {
  directMessage,
  anyOf,
  reactionMatches,
};
