const sinon = require("sinon");
const expect = require("chai").expect;

let stadium;
let deduction;
let balance;
let config;
let client;
let recognitionCollection;
let deductionCollection;
let deductionLockCollection;
let originalConfig;

function response(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

async function seedBalance(user, amount) {
  await recognitionCollection.insertMany(
    Array.from({ length: amount }, (_, index) => ({
      recognizer: `Ugiver-${index}`,
      recognizee: user,
      timestamp: new Date(),
      message: "integration balance",
      channel: "C1",
      values: [],
    })),
  );
}

describe("integration: service/stadium", function () {
  this.timeout(30000);

  before(async () => {
    config = require("../../../config");
    originalConfig = { ...config.stadium };
    Object.assign(config.stadium, {
      apiBaseUrl: "https://sandbox.example/api/v2",
      clientId: "client",
      clientSecret: "secret",
      storeNumber: "store",
      paymentMethod: "use_wallet_money",
      billingCountry: "US",
      billingZipcode: "60601",
      fistbumpsPerUnit: 1,
      pointsPerUnit: 1,
      minimumFistbumps: 1,
      maximumFistbumps: null,
    });
    stadium = require("../../../service/stadium");
    deduction = require("../../../service/deduction");
    balance = require("../../../service/balance");
    recognitionCollection = require("../../../database/recognitionCollection");
    deductionCollection = require("../../../database/deductionCollection");
    deductionLockCollection = require("../../../database/deductionLockCollection");
    client = require("../../../database/db");
    await client.connect();
  });

  after(async () => {
    Object.assign(config.stadium, originalConfig);
    if (client) await client.close();
  });

  beforeEach(async () => {
    stadium.resetTokenCache();
    await Promise.all([
      recognitionCollection.deleteMany({}),
      deductionCollection.deleteMany({}),
      deductionLockCollection.deleteMany({}),
    ]);
  });

  afterEach(() => {
    sinon.restore();
  });

  it("uses a deterministic id, reserves balance, and does not resend a duplicate", async () => {
    await seedBalance("U1", 10);
    const fetchStub = sinon.stub(global, "fetch");
    fetchStub.onCall(0).resolves(response(200, { token: "token" }));
    fetchStub
      .onCall(1)
      .resolves(response(200, { number: "ORDER", payment_state: "paid" }));

    const first = await stadium.redeem({
      user: "U1",
      email: "USER@LIATRIO.COM",
      fistbumps: 4,
      redemptionId: "T1:V1",
    });
    expect(first).to.include({ status: "fulfilled", id: "stadium:T1:V1" });
    const record = await deductionCollection.findOne({ _id: "stadium:T1:V1" });
    expect(record).to.include({
      source: "stadium",
      status: "fulfilled",
      corporateEmail: "user@liatrio.com",
      value: 4,
      refund: false,
    });
    expect(await balance.currentBalance("U1")).to.equal(6);
    expect(await deductionLockCollection.findOne({ _id: "U1" })).to.equal(null);

    const duplicate = await stadium.redeem({
      user: "U1",
      email: "user@liatrio.com",
      fistbumps: 4,
      redemptionId: "T1:V1",
    });
    expect(duplicate.status).to.equal("duplicate");
    expect(fetchStub.callCount).to.equal(2);
  });

  it("uses unresolved Stadium state as the review hold until admin resolution", async () => {
    await seedBalance("U1", 10);
    const fetchStub = sinon.stub(global, "fetch");
    fetchStub.onCall(0).resolves(response(200, { token: "token" }));
    fetchStub.onCall(1).resolves(response(500, {}));

    const uncertain = await stadium.redeem({
      user: "U1",
      email: "user@liatrio.com",
      fistbumps: 4,
      redemptionId: "T1:V2",
    });
    expect(uncertain.status).to.equal("needs_review");
    expect(await deductionLockCollection.findOne({ _id: "U1" })).to.equal(null);
    expect(await deduction.acquireLock("U1", "reward:new")).to.deep.equal({
      acquired: false,
      reason: "stadium-review",
      operationId: "stadium:T1:V2",
    });

    const resolved = await stadium.resolveRedemption(
      "stadium:T1:V2",
      "refund",
      "Uadmin",
    );
    expect(resolved.status).to.equal("refunded");
    expect(await deductionLockCollection.findOne({ _id: "U1" })).to.equal(null);
    expect(await balance.currentBalance("U1")).to.equal(10);
    expect(
      (await stadium.resolveRedemption("stadium:T1:V2", "refund", "Uadmin"))
        .status,
    ).to.equal("not_found");
  });

  it("claims review notifications once and retries failed delivery later", async () => {
    await deductionCollection.insertOne({
      _id: "stadium:notification",
      source: "stadium",
      status: "needs_review",
      user: "U1",
      value: 4,
      refund: false,
      timestamp: new Date(),
      updatedAt: new Date(),
    });
    const now = new Date("2026-08-27T12:00:00.000Z");

    const concurrent = await Promise.all([
      stadium.claimReviewNotification("stadium:notification", now),
      stadium.claimReviewNotification("stadium:notification", now),
    ]);
    const firstClaim = concurrent.find(Boolean);
    expect(concurrent.filter(Boolean)).to.have.length(1);

    await stadium.completeReviewNotification(
      "stadium:notification",
      firstClaim.claimId,
      false,
      now,
    );
    expect(
      await stadium.claimReviewNotification(
        "stadium:notification",
        new Date(now.getTime() + 60 * 1000),
      ),
    ).to.equal(null);

    const retry = await stadium.claimReviewNotification(
      "stadium:notification",
      new Date(now.getTime() + 16 * 60 * 1000),
    );
    expect(retry).not.to.equal(null);
    await stadium.completeReviewNotification(
      "stadium:notification",
      retry.claimId,
      true,
      new Date(now.getTime() + 16 * 60 * 1000),
    );
    expect(
      await stadium.claimReviewNotification(
        "stadium:notification",
        new Date(now.getTime() + 32 * 60 * 1000),
      ),
    ).to.equal(null);
  });

  it("reconciles only stale Stadium work and preserves unrelated live locks", async () => {
    const old = new Date(Date.now() - deduction.LOCK_LEASE_MS - 1000);
    const fresh = new Date();
    await deductionCollection.insertMany([
      {
        _id: "stadium:reserved",
        source: "stadium",
        status: "reserved",
        user: "U-reserved",
        value: 2,
        refund: false,
        timestamp: old,
        updatedAt: old,
      },
      {
        _id: "stadium:sending",
        source: "stadium",
        status: "sending",
        user: "U-sending",
        value: 2,
        refund: false,
        timestamp: old,
        updatedAt: old,
      },
      {
        _id: "stadium:fresh",
        source: "stadium",
        status: "sending",
        user: "U-fresh",
        value: 2,
        refund: false,
        timestamp: fresh,
        updatedAt: fresh,
      },
    ]);
    await deductionLockCollection.insertMany([
      {
        _id: "U-reserved",
        operationId: "stadium:reserved",
        kind: "stadium-in-flight",
        ownerId: "dead",
        createdAt: old,
        expiresAt: old,
      },
      {
        _id: "U-sending",
        operationId: "stadium:sending",
        kind: "stadium-in-flight",
        ownerId: "dead",
        createdAt: old,
        expiresAt: old,
      },
      {
        _id: "U-fresh",
        operationId: "stadium:fresh",
        kind: "stadium-in-flight",
        ownerId: "live",
        createdAt: fresh,
        expiresAt: new Date(fresh.getTime() + deduction.LOCK_LEASE_MS),
      },
      {
        _id: "U-other",
        operationId: "reward:active",
        kind: "ephemeral",
        ownerId: "other-instance",
        createdAt: fresh,
        expiresAt: new Date(fresh.getTime() + deduction.LOCK_LEASE_MS),
      },
      {
        _id: "U-legacy",
        operationId: "stadium:already-resolved",
        kind: "stadium-review",
        ownerId: null,
        createdAt: old,
      },
    ]);

    const result = await stadium.reconcilePending();
    expect(result).to.deep.include({ refunded: 1, needsReview: 1 });
    expect(
      await deductionCollection.findOne({ _id: "stadium:reserved" }),
    ).to.include({ status: "failed", refund: true });
    expect(
      await deductionCollection.findOne({ _id: "stadium:sending" }),
    ).to.include({ status: "needs_review", refund: false });
    expect(
      await deductionCollection.findOne({ _id: "stadium:fresh" }),
    ).to.include({ status: "sending" });
    expect(
      await deductionLockCollection.findOne({ _id: "U-other" }),
    ).to.include({ operationId: "reward:active" });
    expect(
      await deductionLockCollection.findOne({ _id: "U-fresh" }),
    ).to.include({ operationId: "stadium:fresh" });
    expect(await deductionLockCollection.findOne({ _id: "U-legacy" })).to.equal(
      null,
    );
  });
});
