// Transactions for the JSON database (src/server/jsonTransaction.ts): a route either saves its
// whole change, once, before replying, or changes nothing. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createTransactions, NOTHING_CHANGED_MESSAGE } from "../src/server/jsonTransaction";

// A stand-in for Express's response: records the status, the body and the order things happen.
function fakeResponse(log: string[]) {
  const res: any = { statusCode: 200, body: undefined };
  res.status = (code: number) => { res.statusCode = code; return res; };
  res.json = (body: unknown) => { res.body = body; log.push(`reply ${res.statusCode}`); return res; };
  return res;
}

function setup(writeFails = false) {
  const log: string[] = [];
  const db: any = { advances: [{ id: "a1", status: "Requested" }], audit: [] };
  const tx = createTransactions(db, () => {
    log.push("write");
    if (writeFails) throw new Error("disk full");
  });
  // What server.ts's saveDB does: wait for the transaction's end when one is running.
  const saveDB = () => { if (!tx.deferSave()) log.push("write now"); };
  return { db, log, tx, saveDB };
}

test("a change is written once, at the end, and only then is the reply sent", () => {
  const { db, log, tx, saveDB } = setup();
  const route = tx.transactional((_req, res) => {
    db.advances[0].status = "Released";
    db.audit.push("Release Cash Advance");
    saveDB(); // logEvent saves along the way
    saveDB();
    res.json({ status: "success" });
  });
  const res = fakeResponse(log);
  route({ method: "POST", url: "/x" }, res);
  assert.deepEqual(log, ["write", "reply 200"]);
  assert.equal(db.advances[0].status, "Released");
  assert.deepEqual(res.body, { status: "success" });
});

test("a refusal that changed nothing writes nothing", () => {
  const { log, tx } = setup();
  const res = fakeResponse(log);
  tx.transactional((_req, r) => r.status(409).json({ status: "error", message: "Already released." }))({}, res);
  assert.deepEqual(log, ["reply 409"]);
});

test("a refusal after a change undoes the change, and sends no email", () => {
  const { db, log, tx } = setup();
  const before = JSON.stringify(db);
  const res = fakeResponse(log);
  tx.transactional((_req, r) => {
    db.advances[0].status = "Released"; // a mistake: changing before deciding to refuse
    tx.afterCommit(() => log.push("email"));
    r.status(409).json({ status: "error", message: "Refused." });
  })({}, res);
  assert.equal(JSON.stringify(db), before);
  assert.deepEqual(log, ["reply 409"]);
});

test("an async handler is refused when the route is set up", () => {
  const { tx } = setup();
  assert.throws(() => tx.transactional(async () => {}), /synchronous/);
});

test("a handler that returns a promise anyway is undone", () => {
  const { db, log, tx } = setup();
  const before = JSON.stringify(db);
  const res = fakeResponse(log);
  const silence = console.error;
  console.error = () => {};
  try {
    tx.transactional(() => {
      db.advances[0].status = "Released";
      return Promise.resolve();
    })({}, res);
  } finally {
    console.error = silence;
  }
  assert.equal(JSON.stringify(db), before);
  assert.deepEqual(log, ["reply 500"]);
});

test("a step that throws undoes everything: nothing is saved, and the caller is told", () => {
  const { db, log, tx, saveDB } = setup();
  const before = JSON.stringify(db);
  const res = fakeResponse(log);
  const silence = console.error;
  console.error = () => {};
  try {
    tx.transactional(() => {
      db.advances[0].status = "Released";
      db.audit.push("half done");
      saveDB();
      throw new Error("a bug half-way through, before the reply");
    })({}, res);
  } finally {
    console.error = silence;
  }
  assert.equal(JSON.stringify(db), before);
  assert.deepEqual(log, ["reply 500"]);
  assert.deepEqual(res.body, { status: "error", message: NOTHING_CHANGED_MESSAGE });
});

test("a save that fails undoes the change too, so 'success' is never sent", () => {
  const { db, log, tx, saveDB } = setup(true);
  const before = JSON.stringify(db);
  const res = fakeResponse(log);
  const silence = console.error;
  console.error = () => {};
  try {
    tx.transactional((_req, r) => {
      db.advances[0].status = "Released";
      saveDB();
      r.json({ status: "success" });
    })({}, res);
  } finally {
    console.error = silence;
  }
  assert.equal(JSON.stringify(db), before);
  assert.deepEqual(log, ["write", "reply 500"]);
  assert.equal(res.statusCode, 500);
});

test("outside a transaction, saves and emails happen at once", () => {
  const { log, tx, saveDB } = setup();
  saveDB();
  tx.afterCommit(() => log.push("email"));
  assert.deepEqual(log, ["write now", "email"]);
});

test("an email waits for the save, and an undone change sends none", () => {
  const { db, log, tx, saveDB } = setup();
  tx.transactional((_req, r) => {
    db.advances[0].status = "Released";
    tx.afterCommit(() => log.push("email"));
    saveDB();
    r.json({ status: "success" });
  })({}, fakeResponse(log));
  assert.deepEqual(log, ["write", "email", "reply 200"]);

  log.length = 0;
  const silence = console.error;
  console.error = () => {};
  try {
    tx.transactional(() => {
      tx.afterCommit(() => log.push("email"));
      throw new Error("undone");
    })({}, fakeResponse(log));
  } finally {
    console.error = silence;
  }
  assert.deepEqual(log, ["reply 500"]);
});
