# Testing Guide

## Testing Philosophy

Tests in Gratibot cover the service layer — the business logic that validates inputs,
queries the database, and computes results. Feature handlers (the Slack event bindings in
`features/`) are not directly unit-tested; their correctness is validated by the service
tests plus manual verification against a dev Slack app.

When implementing a change, include tests that cover:
- The primary success path
- Key validation failures and error cases
- Any conditional branches your change introduces

## Stack

| Tool | Role |
|---|---|
| [Mocha](https://mochajs.org/) | Test runner and `describe`/`it` structure |
| [Chai](https://www.chaijs.com/) | Assertion library (`expect` style) |
| [chai-as-promised](https://github.com/domenic/chai-as-promised) | Promise-aware assertions (`eventually`, `rejectedWith`) |
| [Sinon](https://sinonjs.org/) | Stubs, spies, and fake timers |
| [nyc](https://github.com/istanbuljs/nyc) | Code coverage (wraps Mocha) |
| [mocha-suppress-logs](https://github.com/Xalanq/mocha-suppress-logs) | Silences console output during tests |

## Test Structure

Tests live in `test/` and mirror the source structure:

```
test/
├── setup.js                  # Global setup: chai plugins, log suppression
├── service/
│   ├── apiwrappers.js        # Tests for service/apiwrappers.js
│   ├── balance.js
│   ├── deduction.js
│   ├── leaderboard.js
│   ├── messageutils.js
│   ├── metrics.js
│   ├── recognition.js
│   ├── redeem.js
│   └── refund.js
├── middleware/
│   └── index.js
└── mocks/                    # Shared test fixtures
```

When adding a new service file, add a corresponding test file at the same relative path
under `test/service/`.

## Running Tests

```bash
# Full test run with coverage report (use this most of the time)
npm test

# Run lint (before committing)
npm run lint
```

## Writing Tests

### Basic Structure

```javascript
const sinon = require("sinon");
const expect = require("chai").expect;

const myService = require("../../service/my-service");
const recognitionCollection = require("../../database/recognitionCollection");

describe("service/my-service", () => {
  // Always restore stubs after each test
  afterEach(() => {
    sinon.restore();
  });

  describe("myFunction", () => {
    it("should return the expected value when conditions are met", async () => {
      // Arrange
      sinon.stub(recognitionCollection, "find").resolves([/* fake records */]);

      // Act
      const result = await myService.myFunction("arg1", "arg2");

      // Assert
      expect(result).to.equal(expectedValue);
    });

    it("should throw an error when input is invalid", async () => {
      await expect(myService.myFunction(null)).to.be.rejectedWith("expected message");
    });
  });
});
```

### Stubbing Database Collections

Database collections are the primary thing to stub. Import the collection and stub the
collection method you need:

```javascript
const recognitionCollection = require("../../database/recognitionCollection");
const goldenRecognitionCollection = require("../../database/goldenRecognitionCollection");
const deductionCollection = require("../../database/deductionCollection");

// Stub a find query
sinon.stub(recognitionCollection, "find").returns({ toArray: sinon.stub().resolves([
  { recognizer: "U001", recognizee: "U002", timestamp: new Date(), message: "great work!", values: [] }
]) });

// Stub a findOne query
sinon.stub(goldenRecognitionCollection, "findOne").resolves({
  recognizer: "U001",
  recognizee: "U002",
  timestamp: new Date(2020, 1, 1),
  message: "well done",
  channel: "C001",
  values: [],
});

// Stub a findOne that returns nothing (e.g., no golden holder seeded yet)
sinon.stub(goldenRecognitionCollection, "findOne").resolves(null);
sinon.stub(goldenRecognitionCollection, "insertOne").resolves({});

// Stub an insert
sinon.stub(recognitionCollection, "insertOne").resolves({ acknowledged: true, insertedId: "fake-id" });
```

Always call `sinon.restore()` in `afterEach` to prevent stub leakage between tests.

### Stubbing with Call-Specific Behavior

Use `.onCall()` when a collection method is called multiple times with different expected results:

```javascript
const stub = sinon.stub(recognitionCollection, "find");
stub.onFirstCall().returns({ toArray: sinon.stub().resolves([/* recognitions given */]) });
stub.onSecondCall().returns({ toArray: sinon.stub().resolves([/* recognitions received */]) });
```

### Testing with Fake Time

Use Sinon's fake timers when your code depends on `new Date()` or `Date.now()`:

```javascript
it("should not count recognitions from yesterday", async () => {
  sinon.useFakeTimers(new Date(2020, 1, 15)); // freeze time at Feb 15 2020
  sinon.stub(recognitionCollection, "find").resolves([
    { timestamp: new Date(2020, 1, 14), /* ... */ } // yesterday — should be excluded
  ]);

  const result = await balance.getRemainingRecognitions("U001");
  expect(result).to.equal(5); // full daily allowance
});
```

### Testing Promise Rejections

Use `chai-as-promised` for async error assertions (already initialized in `test/setup.js`):

```javascript
// Check that the promise rejects with a specific error type
await expect(myService.validate(badInput))
  .to.be.rejectedWith(GratitudeError);

// Check the rejection message
await expect(myService.validate(badInput))
  .to.be.rejectedWith("Message must be at least 20 characters");
```

### Testing Configuration Overrides

Some services read from `config.js`. Override config values for a test by requiring
and mutating the config object, then restoring it:

```javascript
const config = require("../../config");

it("should enforce the configured maximum", async () => {
  const originalMax = config.maximum;
  config.maximum = 3;

  try {
    // ... test code ...
  } finally {
    config.maximum = originalMax;
  }
});
```

Alternatively, use `sinon.stub` on the config property:
```javascript
sinon.stub(config, "maximum").value(3);
// automatically restored in afterEach via sinon.restore()
```

## Test Conventions

- Use `describe` blocks to group tests by function name: `describe("service/recognition", () => { describe("giveRecognition", () => { ... }) })`
- Use `it` descriptions that read as plain English assertions: `it("should return false when the user is not the holder")`
- Do not use arrow functions in `describe` or `it` blocks — Mocha binds `this` for context; arrow functions break that. (ESLint mocha rules enforce this.)
- Each `it` block should test exactly one behavior
- Keep test data minimal — only include fields that matter for the assertion being made

## Coverage

Code coverage is measured by nyc. Coverage is tracked but there is no hard enforcement
gate in CI currently. Aim to cover all branches in service-layer code, especially
validation logic and error paths.

## Global Test Setup (`test/setup.js`)

This file runs before all tests and:
- Initializes `chai-as-promised` with `chai.use(chaiAsPromised)`
- Configures Winston to be silent during test runs

It is loaded automatically by Mocha via the `--require` flag in the Mocha config. You
do not need to require it manually in individual test files.
