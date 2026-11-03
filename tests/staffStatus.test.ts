// Whether someone is still with the office: their staff record, and the logins linked to it (the user's report of
// 2026-11-03: an archived account stayed in Monitoring). Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loginClosed, stillWithOffice } from "../src/staffStatus";

test("a login is closed once archived or deactivated, and only then", () => {
  assert.equal(loginClosed("Archived"), true);
  assert.equal(loginClosed("Deactivated"), true);
  assert.equal(loginClosed("Active"), false);
  assert.equal(loginClosed("Pending Password Change"), false);
  assert.equal(loginClosed(undefined), false);
});

test("staff with no login are with the office, unless their record is marked inactive", () => {
  assert.equal(stillWithOffice({}, []), true);
  assert.equal(stillWithOffice({ isActive: true }, []), true);
  assert.equal(stillWithOffice({ isActive: false }, []), false);
});

test("every linked login archived or deactivated: no longer with the office", () => {
  assert.equal(stillWithOffice({}, [{ status: "Archived" }]), false);
  assert.equal(stillWithOffice({}, [{ status: "Deactivated" }]), false);
  assert.equal(stillWithOffice({}, [{ status: "Archived" }, { status: "Deactivated" }]), false);
});

test("one login still working is enough, a new one waiting for its first password included", () => {
  assert.equal(stillWithOffice({}, [{ status: "Active" }]), true);
  assert.equal(stillWithOffice({}, [{ status: "Pending Password Change" }]), true);
  assert.equal(stillWithOffice({}, [{ status: "Archived" }, { status: "Active" }]), true);
  // A login with no status is an older account that works.
  assert.equal(stillWithOffice({}, [{}]), true);
});

test("a record marked inactive stays out whatever its logins", () => {
  assert.equal(stillWithOffice({ isActive: false }, [{ status: "Active" }]), false);
});

test("no staff record, or a damaged login list entry", () => {
  assert.equal(stillWithOffice(undefined, []), false);
  assert.equal(stillWithOffice(null, [{ status: "Active" }]), false);
  assert.equal(stillWithOffice({}, [null, undefined]), true);
  assert.equal(stillWithOffice({}, [null, { status: "Archived" }]), false);
});
