const sinon = require("sinon");
const expect = require("chai").expect;

const config = require("../../config");
const stadium = require("../../service/stadium");
const balance = require("../../service/balance");
const deduction = require("../../service/deduction");
const deductionCollection = require("../../database/deductionCollection");

function response(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

describe("service/stadium", () => {
  let originalConfig;

  beforeEach(() => {
    originalConfig = { ...config.stadium };
    Object.assign(config.stadium, {
      apiBaseUrl: "https://sandbox.example/api/v2",
      clientId: "client",
      clientSecret: "secret",
      storeNumber: "store-1",
      paymentMethod: "use_wallet_money",
      billingCountry: "US",
      billingZipcode: "60601",
      emailSource: "modal",
      fistbumpsPerUnit: 2,
      pointsPerUnit: 5,
      minimumFistbumps: 2,
      maximumFistbumps: 20,
    });
    stadium.resetTokenCache();
  });

  afterEach(() => {
    Object.assign(config.stadium, originalConfig);
    stadium.resetTokenCache();
    sinon.restore();
  });

  it("normalizes only exact Liatrio corporate emails", () => {
    expect(stadium.normalizeCorporateEmail(" Person@Liatrio.com ")).to.equal(
      "person@liatrio.com",
    );
    expect(() =>
      stadium.normalizeCorporateEmail("person@evil-liatrio.com"),
    ).to.throw(stadium.StadiumError);
    expect(() => stadium.normalizeCorporateEmail("missing-at-sign")).to.throw(
      stadium.StadiumError,
    );
    try {
      stadium.normalizeCorporateEmail("contractor@example.com");
    } catch (error) {
      expect(error.userMessage).to.include("@liatrio.com email");
    }
  });

  it("accepts only the documented email sources", () => {
    expect(stadium.validateEmailSource("modal")).to.equal("modal");
    expect(stadium.validateEmailSource("slack")).to.equal("slack");
    expect(() => stadium.validateEmailSource("fallback")).to.throw(
      stadium.StadiumError,
      "Invalid Stadium email source.",
    );
  });

  it("converts configured whole conversion units and rejects invalid amounts", () => {
    expect(stadium.fistbumpsToPoints(4)).to.equal(10);
    for (const value of [1, 3, 21, 1.5, NaN]) {
      expect(() => stadium.fistbumpsToPoints(value)).to.throw(
        stadium.StadiumError,
      );
    }
  });

  it("reports invalid conversion limits as configuration errors", () => {
    for (const maximum of [0, NaN, 1.5]) {
      config.stadium.maximumFistbumps = maximum;
      try {
        stadium.fistbumpsToPoints(4);
        expect.fail("expected invalid configuration to throw");
      } catch (error) {
        expect(error).to.be.instanceOf(stadium.StadiumError);
        expect(error.message).to.equal(
          "Invalid Stadium conversion configuration.",
        );
        expect(error.userMessage).to.include("conversion settings are invalid");
      }
    }

    config.stadium.maximumFistbumps = 20;
    config.stadium.minimumFistbumps = 1;
    expect(() => stadium.fistbumpsToPoints(4)).to.throw(
      stadium.StadiumError,
      "Invalid Stadium conversion configuration.",
    );
  });

  it("explains when an amount is not a complete conversion unit", () => {
    expect(() => stadium.fistbumpsToPoints(3)).to.throw(
      stadium.StadiumError,
      "in multiples of 2",
    );
  });

  it("rejects an undocumented payment method before authenticating", async () => {
    config.stadium.paymentMethod = "credit_card";
    const fetchStub = sinon.stub(global, "fetch");
    await expect(stadium.getAccessToken()).to.be.rejectedWith(
      stadium.StadiumError,
      "Invalid Stadium payment method",
    );
    expect(fetchStub.called).to.equal(false);
  });

  it("builds a whole-number modal capped by current balance", () => {
    const modal = stadium.buildRedemptionModal(12);
    expect(modal.callback_id).to.equal("stadium_redeem_submit");
    expect(JSON.parse(modal.private_metadata)).to.deep.equal({
      emailSource: "modal",
    });
    const email = modal.blocks.find(
      (block) => block.block_id === "stadium_email",
    );
    expect(email.element.type).to.equal("email_text_input");
    const input = modal.blocks.find(
      (block) => block.block_id === "stadium_amount",
    ).element;
    expect(input.type).to.equal("number_input");
    expect(input.is_decimal_allowed).to.equal(false);
    expect(input.min_value).to.equal("2");
    expect(input.max_value).to.equal("12");
  });

  it("builds an immediately-openable modal without querying a balance", () => {
    config.stadium.maximumFistbumps = null;
    const modal = stadium.buildRedemptionModal();
    expect(modal.blocks[0].text.text).to.include(
      "balance will be checked when you submit",
    );
    const input = modal.blocks.find(
      (block) => block.block_id === "stadium_amount",
    ).element;
    expect(input).not.to.have.property("max_value");
  });

  it("omits the email field when Slack supplies the address", () => {
    config.stadium.emailSource = "slack";
    const modal = stadium.buildRedemptionModal();
    expect(JSON.parse(modal.private_metadata)).to.deep.equal({
      emailSource: "slack",
    });
    expect(
      modal.blocks.some((block) => block.block_id === "stadium_email"),
    ).to.equal(false);
  });

  it("authenticates, caches the token, and sends the expected points payload", async () => {
    const fetchStub = sinon.stub(global, "fetch");
    fetchStub
      .onCall(0)
      .resolves(response(200, { token: "token", expires_in: 3600 }));
    fetchStub
      .onCall(1)
      .resolves(response(200, { number: "ORDER-1", payment_state: "paid" }));
    fetchStub
      .onCall(2)
      .resolves(response(200, { number: "ORDER-2", payment_state: "paid" }));

    const first = await stadium.sendPoints({
      email: "person@liatrio.com",
      points: 10,
      redemptionId: "stadium:T:V",
    });
    await stadium.sendPoints({
      email: "person@liatrio.com",
      points: 5,
      redemptionId: "stadium:T:V2",
    });

    expect(first.orderNumber).to.equal("ORDER-1");
    expect(fetchStub.callCount).to.equal(3);
    const request = JSON.parse(fetchStub.secondCall.args[1].body);
    expect(request).to.include({
      contact_emails: "person@liatrio.com",
      organizer_share: 10,
      auto_accept_points: true,
      send_shop_points: true,
    });
    expect(request.payment_method).to.deep.equal(["use_wallet_money"]);
    expect(fetchStub.secondCall.args[1].headers.authorization).to.equal(
      "Bearer token",
    );
  });

  it("classifies client rejection as definite and server/malformed results as ambiguous", async () => {
    const fetchStub = sinon.stub(global, "fetch");
    fetchStub.onCall(0).resolves(response(200, { token: "one" }));
    fetchStub.onCall(1).resolves(response(422, { error: "invalid" }));
    await expect(
      stadium.sendPoints({ email: "x", points: 1, redemptionId: "one" }),
    ).to.be.rejected.then((error) =>
      expect(error.classification).to.equal("definite"),
    );

    stadium.resetTokenCache();
    fetchStub.onCall(2).resolves(response(200, { token: "two" }));
    fetchStub.onCall(3).resolves(response(500, {}));
    await expect(
      stadium.sendPoints({ email: "x", points: 1, redemptionId: "two" }),
    ).to.be.rejected.then((error) =>
      expect(error.classification).to.equal("ambiguous"),
    );

    stadium.resetTokenCache();
    fetchStub.onCall(4).resolves(response(200, { token: "three" }));
    fetchStub
      .onCall(5)
      .resolves(response(200, { number: "ORDER", payment_state: "pending" }));
    await expect(
      stadium.sendPoints({ email: "x", points: 1, redemptionId: "three" }),
    ).to.be.rejected.then((error) =>
      expect(error.classification).to.equal("ambiguous"),
    );
  });

  it("evicts a cached token after Stadium returns 401", async () => {
    const fetchStub = sinon.stub(global, "fetch");
    fetchStub.onCall(0).resolves(response(200, { token: "revoked" }));
    fetchStub.onCall(1).resolves(response(401, { error: "invalid token" }));
    await expect(
      stadium.sendPoints({ email: "x", points: 1, redemptionId: "one" }),
    ).to.be.rejectedWith(stadium.StadiumError);

    fetchStub.onCall(2).resolves(response(200, { token: "replacement" }));
    fetchStub
      .onCall(3)
      .resolves(response(200, { number: "ORDER", payment_state: "paid" }));
    await stadium.sendPoints({ email: "x", points: 1, redemptionId: "two" });
    expect(fetchStub.getCall(2).args[0]).to.include("/oauth/token");
    expect(fetchStub.getCall(3).args[1].headers.authorization).to.equal(
      "Bearer replacement",
    );
  });

  it("fulfills a redemption and releases its balance lock", async () => {
    sinon.stub(deduction, "acquireLock").resolves({ acquired: true });
    sinon.stub(deduction, "releaseLock").resolves();
    sinon.stub(balance, "currentBalance").resolves(10);
    sinon.stub(deductionCollection, "insertOne").resolves({});
    sinon.stub(deductionCollection, "updateOne").resolves({ modifiedCount: 1 });
    const fetchStub = sinon.stub(global, "fetch");
    fetchStub.onCall(0).resolves(response(200, { token: "token" }));
    fetchStub
      .onCall(1)
      .resolves(response(200, { number: "ORDER", payment_state: "paid" }));

    const result = await stadium.redeem({
      user: "U1",
      email: "user@liatrio.com",
      fistbumps: 4,
      redemptionId: "T:V",
    });
    expect(result).to.include({ status: "fulfilled", stadiumPoints: 10 });
    expect(deduction.releaseLock.calledWith("U1", "stadium:T:V")).to.equal(
      true,
    );
  });

  it("refunds a definite rejection and marks an ambiguous result for review", async () => {
    sinon.stub(deduction, "acquireLock").resolves({ acquired: true });
    sinon.stub(deduction, "releaseLock").resolves();
    sinon.stub(balance, "currentBalance").resolves(10);
    sinon.stub(deductionCollection, "insertOne").resolves({});
    const update = sinon
      .stub(deductionCollection, "updateOne")
      .resolves({ modifiedCount: 1 });
    const fetchStub = sinon.stub(global, "fetch");
    fetchStub.onCall(0).resolves(response(200, { token: "one" }));
    fetchStub.onCall(1).resolves(response(422, {}));
    expect(
      (
        await stadium.redeem({
          user: "U1",
          email: "user@liatrio.com",
          fistbumps: 4,
          redemptionId: "definite",
        })
      ).status,
    ).to.equal("failed");
    expect(
      update.getCalls().some((call) => call.args[1].$set?.refund === true),
    ).to.equal(true);

    stadium.resetTokenCache();
    fetchStub.onCall(2).resolves(response(200, { token: "two" }));
    fetchStub.onCall(3).resolves(response(500, {}));
    expect(
      (
        await stadium.redeem({
          user: "U2",
          email: "user@liatrio.com",
          fistbumps: 4,
          redemptionId: "ambiguous",
        })
      ).status,
    ).to.equal("needs_review");
    expect(
      update
        .getCalls()
        .some((call) => call.args[1].$set?.status === "needs_review"),
    ).to.equal(true);
    expect(
      update
        .getCalls()
        .some(
          (call) =>
            call.args[1].$set?.reviewNotification?.nextAttemptAt instanceof
            Date,
        ),
    ).to.equal(true);
    expect(
      deduction.releaseLock.calledWith("U2", "stadium:ambiguous"),
    ).to.equal(true);
  });

  it("CAS-guards an ambiguous transition and omits missing error details", async () => {
    sinon.stub(deduction, "acquireLock").resolves({ acquired: true });
    sinon.stub(deduction, "releaseLock").resolves();
    sinon.stub(balance, "currentBalance").resolves(10);
    sinon.stub(deductionCollection, "insertOne").resolves({});
    const update = sinon.stub(deductionCollection, "updateOne");
    update.onCall(0).resolves({ modifiedCount: 1 });
    update.onCall(1).rejects(new Error("database response lost"));
    update.onCall(2).resolves({ modifiedCount: 1 });
    const fetchStub = sinon.stub(global, "fetch");
    fetchStub.onCall(0).resolves(response(200, { token: "token" }));
    fetchStub
      .onCall(1)
      .resolves(response(200, { number: "ORDER", payment_state: "paid" }));

    const result = await stadium.redeem({
      user: "U1",
      email: "user@liatrio.com",
      fistbumps: 4,
      redemptionId: "cas",
    });

    expect(result.status).to.equal("needs_review");
    expect(update.thirdCall.args[0]).to.deep.equal({
      _id: "stadium:cas",
      status: { $in: ["sending"] },
    });
    expect(update.thirdCall.args[1].$set).not.to.have.property("stadium");
  });

  it("does not overwrite a terminal state after a delayed request resumes", async () => {
    sinon.stub(deduction, "acquireLock").resolves({ acquired: true });
    sinon.stub(deduction, "releaseLock").resolves();
    sinon.stub(balance, "currentBalance").resolves(10);
    sinon.stub(deductionCollection, "insertOne").resolves({});
    const update = sinon.stub(deductionCollection, "updateOne");
    update.onCall(0).resolves({ modifiedCount: 1 });
    update.onCall(1).rejects(new Error("database response lost"));
    update.onCall(2).resolves({ modifiedCount: 0 });
    sinon.stub(deductionCollection, "findOne").resolves({
      _id: "stadium:terminal",
      status: "refunded",
      refund: true,
    });
    const fetchStub = sinon.stub(global, "fetch");
    fetchStub.onCall(0).resolves(response(200, { token: "token" }));
    fetchStub
      .onCall(1)
      .resolves(response(200, { number: "ORDER", payment_state: "paid" }));

    const result = await stadium.redeem({
      user: "U1",
      email: "user@liatrio.com",
      fistbumps: 4,
      redemptionId: "terminal",
    });

    expect(result.status).to.equal("failed");
    expect(update.thirdCall.args[0]).to.have.nested.property("status.$in");
  });

  it("records a paid response that arrives after reconciliation", async () => {
    sinon.stub(deduction, "acquireLock").resolves({ acquired: true });
    sinon.stub(deduction, "releaseLock").resolves();
    sinon.stub(balance, "currentBalance").resolves(10);
    sinon.stub(deductionCollection, "insertOne").resolves({});
    const update = sinon.stub(deductionCollection, "updateOne");
    update.onCall(0).resolves({ modifiedCount: 1 });
    update.onCall(1).resolves({ modifiedCount: 0 });
    update.onCall(2).resolves({ modifiedCount: 1 });
    const fetchStub = sinon.stub(global, "fetch");
    fetchStub.onCall(0).resolves(response(200, { token: "token" }));
    fetchStub
      .onCall(1)
      .resolves(response(200, { number: "ORDER", payment_state: "paid" }));

    const result = await stadium.redeem({
      user: "U1",
      email: "user@liatrio.com",
      fistbumps: 4,
      redemptionId: "late",
    });

    expect(result).to.include({
      status: "fulfilled",
      stadiumPoints: 10,
      orderNumber: "ORDER",
    });
    expect(update.thirdCall.args[0]).to.deep.equal({
      _id: "stadium:late",
      status: "needs_review",
    });
    expect(update.thirdCall.args[1].$set).to.deep.include({
      status: "fulfilled",
      stadium: { orderNumber: "ORDER", paymentState: "paid" },
    });
  });

  it("reports a late paid response that conflicts with an admin refund", async () => {
    sinon.stub(deduction, "acquireLock").resolves({ acquired: true });
    sinon.stub(deduction, "releaseLock").resolves();
    sinon.stub(balance, "currentBalance").resolves(10);
    sinon.stub(deductionCollection, "insertOne").resolves({});
    const update = sinon.stub(deductionCollection, "updateOne");
    update.onCall(0).resolves({ modifiedCount: 1 });
    update.onCall(1).resolves({ modifiedCount: 0 });
    update.onCall(2).resolves({ modifiedCount: 0 });
    sinon.stub(deductionCollection, "findOne").resolves({
      _id: "stadium:conflict",
      status: "refunded",
      refund: true,
    });
    const fetchStub = sinon.stub(global, "fetch");
    fetchStub.onCall(0).resolves(response(200, { token: "token" }));
    fetchStub
      .onCall(1)
      .resolves(response(200, { number: "ORDER", payment_state: "paid" }));

    const result = await stadium.redeem({
      user: "U1",
      email: "user@liatrio.com",
      fistbumps: 4,
      redemptionId: "conflict",
    });

    expect(result).to.include({
      status: "resolution_conflict",
      terminalStatus: "refunded",
      orderNumber: "ORDER",
    });
  });

  it("returns busy or insufficient without dispatching points", async () => {
    sinon
      .stub(deduction, "acquireLock")
      .onCall(0)
      .resolves({
        acquired: false,
        reason: "stadium-review",
        operationId: "stadium:old",
      })
      .onCall(1)
      .resolves({ acquired: true });
    sinon.stub(deduction, "releaseLock").resolves();
    sinon.stub(balance, "currentBalance").resolves(1);
    expect(
      await stadium.redeem({
        user: "U",
        email: "u@liatrio.com",
        fistbumps: 2,
        redemptionId: "1",
      }),
    ).to.deep.include({
      status: "busy",
      reason: "stadium-review",
      operationId: "stadium:old",
    });
    expect(
      (
        await stadium.redeem({
          user: "U",
          email: "u@liatrio.com",
          fistbumps: 2,
          redemptionId: "2",
        })
      ).status,
    ).to.equal("insufficient");
  });

  it("resolves an uncertain redemption and releases the held lock", async () => {
    sinon.stub(deductionCollection, "findOne").resolves({
      _id: "stadium:T:V",
      user: "U1",
    });
    sinon.stub(deductionCollection, "updateOne").resolves({ modifiedCount: 1 });
    sinon.stub(deduction, "releaseLock").resolves();
    const result = await stadium.resolveRedemption(
      "stadium:T:V",
      "refund",
      "Uadmin",
    );
    expect(result.status).to.equal("refunded");
    expect(deduction.releaseLock.calledWith("U1", "stadium:T:V")).to.equal(
      true,
    );
  });

  it("claims and completes durable review notifications", async () => {
    const now = new Date("2026-08-27T12:00:00.000Z");
    const findAndUpdate = sinon
      .stub(deductionCollection, "findOneAndUpdate")
      .resolves({ _id: "stadium:T:V", user: "U1" });
    const update = sinon
      .stub(deductionCollection, "updateOne")
      .resolves({ modifiedCount: 1 });

    const claim = await stadium.claimReviewNotification("stadium:T:V", now);
    expect(claim.record).to.include({ _id: "stadium:T:V", user: "U1" });
    expect(claim.claimId).to.be.a("string");
    expect(findAndUpdate.firstCall.args[0]).to.deep.include({
      _id: "stadium:T:V",
      source: "stadium",
      status: "needs_review",
    });
    expect(findAndUpdate.firstCall.args[2]).to.deep.equal({
      returnDocument: "after",
    });

    await stadium.completeReviewNotification(
      "stadium:T:V",
      claim.claimId,
      false,
      now,
    );
    expect(
      update.firstCall.args[1].$set["reviewNotification.nextAttemptAt"],
    ).to.be.greaterThan(now);

    await stadium.completeReviewNotification(
      "stadium:T:V",
      claim.claimId,
      true,
      now,
    );
    expect(
      update.secondCall.args[1].$set["reviewNotification.notifiedAt"],
    ).to.equal(now);
  });

  it("reconciles reserved and sending redemptions after startup", async () => {
    const old = new Date(Date.now() - deduction.LOCK_LEASE_MS - 1000);
    const cursors = [
      {
        toArray: sinon
          .stub()
          .resolves([{ _id: "r", user: "U1", updatedAt: old }]),
      },
      {
        toArray: sinon
          .stub()
          .resolves([{ _id: "s", user: "U2", updatedAt: old }]),
      },
    ];
    sinon
      .stub(deductionCollection, "find")
      .onCall(0)
      .returns(cursors[0])
      .onCall(1)
      .returns(cursors[1]);
    sinon.stub(deductionCollection, "updateOne").resolves({ modifiedCount: 1 });
    sinon.stub(deduction, "releaseLock").resolves();
    sinon
      .stub(deduction, "cleanupLegacyReviewLocks")
      .resolves({ deletedCount: 0 });
    sinon.stub(deduction, "cleanupExpiredLocks").resolves({ deletedCount: 0 });
    const result = await stadium.reconcilePending();
    expect(result).to.deep.include({
      refunded: 1,
      needsReview: 1,
    });
    expect(result.refundedRecords[0]._id).to.equal("r");
    expect(result.needsReviewRecords[0]._id).to.equal("s");
    expect(
      deductionCollection.updateOne
        .getCalls()
        .some(
          (call) =>
            call.args[1].$set?.reviewNotification?.nextAttemptAt instanceof
            Date,
        ),
    ).to.equal(true);
    sinon.assert.calledWith(deduction.releaseLock, "U2", "s", {
      force: true,
    });
  });
});
