// Transactions for the JSON database (the user's spec, 2026-10-18: a change that moves money
// either happens completely or not at all). server.ts keeps every record in memory and writes
// the whole file on each save, which has no transactions of its own. A route wrapped in
// `transactional` gets the same guarantees:
// - Isolated: route handlers run synchronously, so no other request runs in the middle of one.
// - All or nothing: the database is copied before the handler runs. If the handler throws,
//   refuses (answers 400 or above), or the save fails, every record is put back as it was and
//   nothing is written. A throw or a failed save answers 500 saying nothing changed.
// - Saved once, before the reply: saves made along the way (saveDB, logEvent) wait for the
//   end, and the reply is held until the change is written, so "success" is never sent for a
//   change that wasn't saved.
// - What can't be taken back, such as an email, waits too (afterCommit): an undone change
//   sends nothing.
// For synchronous handlers only: an async one is refused when the route is set up, and one that
// returns a promise anyway is undone, since what it awaited would run after the transaction.
// The copy costs about as much as one save, on every call (known issue 9).

type Handler = (req: any, res: any) => unknown;

export const NOTHING_CHANGED_MESSAGE = "Something went wrong, so nothing was changed. Please try again.";

export function createTransactions(database: object, write: () => void) {
  const db = database as Record<string, unknown>;
  let active = false;
  let savePending = false;
  let effects: Array<() => void> = [];

  return {
    /** For saveDB: true while a transaction runs, when the save waits for its end instead. */
    deferSave(): boolean {
      if (active) savePending = true;
      return active;
    },

    /** Runs `effect` once the running transaction is saved, or at once outside one. */
    afterCommit(effect: () => void) {
      if (active) effects.push(effect);
      else effect();
    },

    /** Runs a route handler as one transaction (see above). */
    transactional(handler: Handler): Handler {
      if (handler.constructor?.name === "AsyncFunction") {
        throw new Error("transactional() needs a synchronous handler: an awaited step would run after the transaction ended.");
      }
      return (req, res) => {
        // Never nested: a handler doesn't call another route.
        if (active) return handler(req, res);
        const snapshot = JSON.stringify(db);
        const restore = () => {
          for (const key of Object.keys(db)) delete db[key];
          Object.assign(db, JSON.parse(snapshot));
        };
        const send = res.json.bind(res);
        let reply: { body: unknown } | null = null;
        res.json = (body: unknown) => {
          reply = { body };
          return res;
        };
        active = true;
        savePending = false;
        effects = [];
        let failed = false;
        let refused = false;
        try {
          const result: any = handler(req, res);
          if (result && typeof result.then === "function") {
            throw new Error("transactional() handler returned a promise; it must be synchronous.");
          }
          // A refusal changes nothing, whatever the handler did before deciding to refuse.
          refused = Number(res.statusCode) >= 400;
          if (refused) restore();
          else if (savePending) write();
        } catch (err) {
          failed = true;
          restore();
          console.error(`${req?.method} ${req?.originalUrl ?? req?.url} failed and was undone; nothing was saved.`, err);
        } finally {
          active = false;
          savePending = false;
          res.json = send;
        }
        const committed = failed || refused ? [] : effects;
        effects = [];
        for (const effect of committed) {
          try {
            effect();
          } catch (err) {
            console.error("A step after a saved change failed (the change itself is saved).", err);
          }
        }
        if (failed) return res.status(500).json({ status: "error", message: NOTHING_CHANGED_MESSAGE });
        if (reply) return send((reply as { body: unknown }).body);
      };
    }
  };
}
