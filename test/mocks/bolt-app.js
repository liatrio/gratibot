// Minimal Bolt app double for feature-layer tests.
//
// Feature modules export a function that receives the Bolt `app` and calls
// `app.message(...)`, `app.event(...)`, etc. to register handlers. This mock
// captures those registrations so a test can pull a handler out by type and
// invoke it directly with a fake Slack context.

function createMockApp() {
  const registrations = {
    message: [],
    event: [],
    action: [],
    command: [],
    shortcut: [],
    view: [],
    options: [],
  };

  function record(kind) {
    return (...args) => {
      const handler = args[args.length - 1];
      const matchers = args.slice(0, -1);
      registrations[kind].push({ matchers, handler });
    };
  }

  const app = {
    message: record("message"),
    event: record("event"),
    action: record("action"),
    command: record("command"),
    shortcut: record("shortcut"),
    view: record("view"),
    options: record("options"),
  };

  return { app, registrations };
}

module.exports = { createMockApp };
