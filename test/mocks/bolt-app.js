// Minimal Bolt app double for feature-layer tests.
//
// Feature modules export a function that receives the Bolt `app` and calls
// `app.message(...)`, `app.event(...)`, etc. to register handlers. This mock
// captures those registrations so a test can pull a handler out by matcher
// (regex, string, or action constraint object) and invoke it directly with a
// fake Slack context.

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

  function findHandler(kind, matcher) {
    const predicate = matcherPredicate(matcher);
    const reg = registrations[kind].find((r) => r.matchers.some(predicate));
    if (!reg) {
      const available = registrations[kind]
        .map((r) => `[${r.matchers.map(describeMatcher).join(", ")}]`)
        .join(" | ");
      throw new Error(
        `No ${kind} handler registered matching ${describeMatcher(matcher)}. Registered: ${available || "(none)"}`,
      );
    }
    return reg.handler;
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

  return { app, registrations, findHandler };
}

function matcherPredicate(target) {
  if (target instanceof RegExp) {
    return (m) =>
      m instanceof RegExp &&
      m.source === target.source &&
      m.flags === target.flags;
  }
  if (typeof target === "string") {
    return (m) => m === target;
  }
  if (target && typeof target === "object") {
    const keys = Object.keys(target);
    return (m) =>
      m !== null &&
      typeof m === "object" &&
      !(m instanceof RegExp) &&
      keys.every((k) => m[k] === target[k]);
  }
  return () => false;
}

function describeMatcher(m) {
  if (m instanceof RegExp) return m.toString();
  if (typeof m === "string") return JSON.stringify(m);
  if (m && typeof m === "object") return JSON.stringify(m);
  return String(m);
}

module.exports = { createMockApp };
