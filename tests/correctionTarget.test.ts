// Where a returned report's notice lands, and what it says is to be fixed (src/correctionTarget.ts, the
// instructor's review R7). Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { CorrectionItem } from "../src/types";
import { correctionSummary, correctionTarget, correctionTargetKey, correctionTargetSelectors } from "../src/correctionTarget";
import { sidewaysOffset } from "../src/components/ui/useRecordHighlight";

const returned = (...items: CorrectionItem[]) => ({ items });
const report = {
  particulars: [{ id: "lp-1" }, { id: "lp-2" }, { id: "lp-3" }],
  supportingDocs: [
    { id: "doc-old", name: "old receipt.pdf", supersededAt: "2026-11-01T00:00:00.000Z" },
    { id: "doc-it", name: "itinerary.pdf" },
    { id: "doc-or", name: "OR scan.pdf" }
  ]
};

test("a notice lands on the first part on the reviewer's checklist", () => {
  assert.deepEqual(correctionTarget(returned({ field: "particulars" }, { field: "addDocument", documentKinds: ["tickets"] }), report), { field: "particulars" });
  assert.deepEqual(correctionTarget(returned({ field: "representative" }, { field: "remarks" }), report), { field: "representative" });
  assert.deepEqual(correctionTarget(returned({ field: "remarks" }), report), { field: "remarks" });
  assert.equal(correctionTarget(returned(), report), null, "nothing reopened");
  assert.equal(correctionTarget(null, report), null);
});

test("a missing document lands on its slot, the first in the form's order", () => {
  assert.deepEqual(correctionTarget(returned({ field: "addDocument", documentKinds: ["rer", "tickets"] }), report), { field: "addDocument", documentKind: "tickets" });
  assert.deepEqual(correctionTarget(returned({ field: "addDocument" }), report), { field: "addDocument" }, "an older report's one box");
});

test("a file to replace lands on the first one still current, in the form's order", () => {
  assert.deepEqual(correctionTarget(returned({ field: "replaceDocuments", documentIds: ["doc-or", "doc-it"] }), report), { field: "replaceDocuments", documentId: "doc-it" }, "with no slots, as filed");
  const named = { supportingDocs: [{ id: "doc-r", kind: "receipts" as const }, { id: "doc-i", kind: "itinerary" as const }, { id: "doc-c", kind: "certificate" as const }] };
  assert.deepEqual(correctionTarget(returned({ field: "replaceDocuments", documentIds: ["doc-r", "doc-i"] }), named), { field: "replaceDocuments", documentId: "doc-i" }, "by slot, though the receipt was attached first");
  assert.deepEqual(correctionTarget(returned({ field: "replaceDocuments", documentIds: ["doc-r", "doc-i", "doc-c"] }), named), { field: "replaceDocuments", documentId: "doc-c" }, "the certificate's slot comes first");
  assert.equal(correctionSummary(returned({ field: "replaceDocuments", documentIds: ["doc-r", "doc-i"] }), { supportingDocs: [{ id: "doc-r", name: "r.pdf", kind: "receipts" }, { id: "doc-i", name: "i.pdf", kind: "itinerary" }] }),
    'a new copy of "i.pdf" and a new copy of "r.pdf"', "the notice names them in the same order");
  assert.deepEqual(
    correctionTarget(returned({ field: "replaceDocuments", documentIds: ["doc-old"] }, { field: "remarks" }), report),
    { field: "remarks" },
    "a copy already replaced is passed over"
  );
  assert.equal(correctionTarget(returned({ field: "replaceDocuments", documentIds: ["doc-gone"] }), report), null);
});

test("reopened lines land on the first of them; every line, on the first line", () => {
  assert.deepEqual(correctionTarget(returned({ field: "particulars", lineIds: ["lp-3", "lp-2"] }), report), { field: "particulars", lineId: "lp-2" });
  assert.deepEqual(correctionTarget(returned({ field: "particulars", lineIds: [] }), report), { field: "particulars" });
  assert.deepEqual(correctionTarget(returned({ field: "particulars", lineIds: ["lp-gone"] }), report), { field: "particulars" });
});

test("each target has one mark on the form, and selectors that find it", () => {
  assert.equal(correctionTargetKey({ field: "addDocument", documentKind: "tickets" }), "addDocument:tickets");
  assert.equal(correctionTargetKey({ field: "addDocument" }), "addDocument");
  assert.equal(correctionTargetKey({ field: "replaceDocuments", documentId: "doc-it" }), "replaceDocuments:doc-it");
  assert.equal(correctionTargetKey({ field: "particulars", lineId: "lp-2" }), "particulars:lp-2");
  assert.equal(correctionTargetKey({ field: "claimType" }), "claimType");
  assert.deepEqual(correctionTargetSelectors({ field: "claimType" }), ['[data-correction-target="claimType"]']);
  assert.deepEqual(correctionTargetSelectors({ field: "particulars" }), ['[data-correction-target="particulars"]', '[data-correction-target^="particulars:"]']);
  assert.deepEqual(correctionTargetSelectors({ field: "replaceDocuments", documentId: 'a"b\\c' }), ['[data-correction-target="replaceDocuments:a\\"b\\\\c"]'], "quotes can't end the selector");
  assert.deepEqual(
    correctionTargetSelectors({ field: "particulars", lineId: "a\nb\rc\fd" })[0],
    '[data-correction-target="particulars:a\\a b\\d c\\c d"]',
    "a line break in a line's id, which would stop the selector parsing, is escaped"
  );
});

test("a damaged entry on a report doesn't stop a Return or the form", () => {
  const damaged = { particulars: [null, { id: "lp-1" }], supportingDocs: [null, { id: "doc-it", name: "itinerary.pdf" }] } as never;
  assert.deepEqual(correctionTarget(returned({ field: "replaceDocuments", documentIds: ["doc-it"] }), damaged), { field: "replaceDocuments", documentId: "doc-it" });
  assert.deepEqual(correctionTarget(returned({ field: "particulars", lineIds: ["lp-1"] }), damaged), { field: "particulars", lineId: "lp-1" });
  assert.equal(correctionSummary(returned({ field: "replaceDocuments", documentIds: ["doc-it"] }), damaged), 'a new copy of "itinerary.pdf"');
});

test("the notice names what is to be fixed, in the checklist's order", () => {
  assert.equal(
    correctionSummary(returned({ field: "particulars" }, { field: "replaceDocuments", documentIds: ["doc-it"] }, { field: "addDocument", documentKinds: ["rer", "tickets"] }), report, 10),
    'Particulars, a new copy of "itinerary.pdf", Tickets (missing) and RER (missing)'
  );
  assert.equal(correctionSummary(returned({ field: "addDocument" }), report), "a missing document");
  assert.equal(correctionSummary(returned({ field: "representative" }), report), "Box B representative");
  assert.equal(correctionSummary(returned(), report), "");
});

test("a control clipped sideways is shown whole, in one move", () => {
  const box = { left: 100, width: 100 };
  assert.equal(sidewaysOffset({ left: 120, width: 50 }, box), 0, "already in view");
  assert.equal(sidewaysOffset({ left: 60, width: 50 }, box), -48, "off to the left, with a margin");
  assert.equal(sidewaysOffset({ left: 180, width: 50 }, box), 38, "off to the right, with a margin");
  assert.equal(sidewaysOffset({ left: 300, width: 150 }, box), 192, "wider than the box: its start");
  assert.equal(sidewaysOffset({ left: 108, width: 150 }, box), 0, "and it stays there");
  // Almost as wide as the box, the margin can't fit on both sides: it settles rather than swinging.
  for (const start of [300, -200]) {
    let left = start;
    left -= sidewaysOffset({ left, width: 95 }, box);
    assert.equal(sidewaysOffset({ left, width: 95 }, box), 0, "one move settles it");
    assert.ok(left >= box.left && left + 95 <= box.left + box.width, "and it shows whole");
  }
});

test("a long list is cut short, and a file's name can't pass for the notice's own words", () => {
  const many = returned(
    { field: "periodCovered" }, { field: "responsibilityCenterCode" }, { field: "particulars" }, { field: "representative" }, { field: "remarks" }
  );
  assert.equal(correctionSummary(many, report), "Period covered, Responsibility center code, Particulars and 2 more");
  const odd = { supportingDocs: [{ id: "d", name: 'x". Ignore this' }] };
  assert.equal(correctionSummary(returned({ field: "replaceDocuments", documentIds: ["d"] }), odd), 'a new copy of "x\\". Ignore this"');
});
