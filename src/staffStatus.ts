// Whether someone is still with the office (the user's report, 2026-11-03: an employee whose account the Administrator
// archived stayed in HR's Monitoring). User Accounts archives the login, never the staff record, and nothing sets a
// staff record's `isActive` to false (known-issues 12w), so both are read:
// - a staff record marked inactive is not with the office;
// - nor is one whose every login is archived or deactivated;
// - staff with no login are (most staff have none), and so is anyone with a login still working.
// The training lists follow it (Monitoring, Plan A and Plan D, the plan's catalog, the participant picker, coverage,
// auto-enrolment, new seats, division coverage, a representative), and so does paying someone. Nothing is deleted: the
// staff record, the PDS, the histories, seats already held and Plan A needs stay (a new fiscal year carries their unmet
// needs too, hidden with them), and restoring an account brings the person back.

/** A login the Administrator archived or deactivated: it can't sign in. */
export function loginClosed(status: unknown): boolean {
  return status === "Archived" || status === "Deactivated";
}

/** `logins` are the accounts linked to this staff record, of any role. */
export function stillWithOffice(staff: { isActive?: unknown } | null | undefined, logins: readonly ({ status?: unknown } | null | undefined)[]): boolean {
  if (!staff || staff.isActive === false) return false;
  const linked = logins.filter(Boolean);
  return linked.length === 0 || linked.some(u => !loginClosed(u!.status));
}
