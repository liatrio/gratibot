// Test-only no-op Bolt Receiver. Implements the Receiver interface
// (init/start/stop) without binding sockets or HTTP ports, so an integration
// suite can drive a real @slack/bolt App via app.processEvent without any
// network activity.

class NoOpReceiver {
  init(app) {
    this.app = app;
  }

  start() {
    return Promise.resolve();
  }

  stop() {
    return Promise.resolve();
  }
}

module.exports = { NoOpReceiver };
