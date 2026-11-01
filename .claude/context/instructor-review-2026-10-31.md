# The instructor's system review of 2026-10-31 (requirements: cite them when a feature follows one)

The instructor reviewed IntegraSync with the team on 2026-10-31. These recommendations (R1–R12) are a source of requirements, like `hsac-answers.md`. Each one is quoted as we caught it, followed by what to build and the team's decisions of 2026-11-01.

If a recommendation conflicts with an HSAC answer or a recorded decision, stop and ask. Don't choose.

**Approved by the instructor, keep as is:**
- A group cash advance gets one liquidation report for the group, with its contents grouped. With individual advances, each attendee files their own.
- Spending is itemised per expense (meals ₱…, accommodation ₱…).

## Phases

Work one phase at a time: a short plan, the team's OK, build, verify, code review and security review, fix, update the docs. Nothing is committed without being asked.

| Phase | Recommendations | Status (2026-11-01) |
|---|---|---|
| 1 | R1 venue, R2 expense lines, R3 transportation | Built and reviewed 2026-11-01 (known-issues 12aa), not committed |
| 2 | R6 viewer, file allow-list, Print; file storage; 12e | Not started |
| 3 | R4 certificate, R5 required documents | Not started |
| 4 | R7 notices that open on the missing item | Not started |
| 5 | R8 tables and View | Not started |
| 6 | R9 the TDP once a year | Not started |
| 7 | R10 picker, R11 history and reports | Not started |
| 8 | R12 demo data | Not started; ask first |

## Decisions that change earlier ones

- **Reimbursements need a certificate too.** This replaces the 2026-10-30 decision that official receipts are enough (`hsac-answers.md` 9, known-issues 12q). The team didn't answer this one directly. It follows from Q4: nobody reaches the form without HR recording "Attended", and that needs a certificate. Update both documents in Phase 3.
- **"Attended" waits for the certificate.** Requirement 3 let HR record attendance once a seminar starts. Now "Attended" needs a certificate, so in practice it waits until the seminar ends. "Did not attend" can still be recorded from the first day and needs no file. Correcting "Did not attend" to "Attended" also needs a certificate.
- **Carried-over needs don't count as an upload.** A year counts as uploaded "before this change" only if it has Plan A entries that weren't carried over. FY 2027 counts (464 entries, 0 carried). Carried needs survive an upload or a Replace (`POST /api/fiscal-years`, the carry-over rule).
- **The picker keeps its Plan A switch** (12y, HSAC answers 6 and 8). The no-training filter applies inside it. People with a mandated need for the seminar stay visible even if they already had a training this year.
- **Covered group members keep 12v decision 8.** On their own history they see the group report's number and status and their own share. HR and the Administrator see everything. The team's answer here spoke about certificates instead and didn't change decision 8, so it stands unless the team says otherwise.
- **12e closes in Phase 2.** The report list stops sending file contents, and every file opens through a logged per-file route.
- **New files leave the JSON in Phase 2.** They go in a gitignored folder, with only a reference in `data_store.json`, and the repo stops tracking `data_store.json` (known-issues 4, 9, 19). Warn the team first: when they pull that change, git deletes their local copy.

## Still open

- **R12 / Q9, demo data:** how the data gets in. Decide in Phase 8.
- **R11 / Q10, 12r:** the team asked what the records are and why they would be removed. Unless told otherwise, the Review buttons get fixed in Phase 7, not removed.
- **R5, documents:** which of the named documents are always required, and which only when their condition applies. Decide in Phase 3's plan.
- **R9, "Add Training Program":** how it stays while seminars still start from the TDP. Confirm in Phase 6's plan.
- **Known limit, accepted:** a certificate that arrives late holds up the attendance record, then the report (due 30 days after the seminar) and the employee's next cash advance. If this proves common, add "HR records it with a reason", flagged in the audit log.

## The recommendations

### R1. Fill in the venue automatically

Said: "dapat naka fetch na yan, kung saan yung venue" / "yung sa training, walang location."

Build:
- A Venue column in Programs & Budget, beside Facilitator. Required to save a new seminar, or to edit one that hasn't ended. Cleaned with `cleanText`, up to 200 characters, checked by the server the way it checks the title (`seminarTextProblem`).
- Show the venue on the portal's seminar card, in HR's attendance list and in the reports (R11).
- The vehicle request's destination comes from the venue. If the venue is blank, the card tells the employee to ask HR.

### R2. Expense lines: choose the expense type, with no description

Said: "need ng description yung meal? … kumain ako sa tapsilogan?" / "bakit mag aaccomodation kayo e meron na nga click dun na accommodation?" / "hindi bawat isang particular may description … tanggalin niyo na."

Team's decision: no description box at all, not even an optional one ("kung pwede ket wag na maglagay ng description box kahit optional kasi may masasabi na naman"). This replaces the brief's optional description.

Build:
- Each line is an expense type plus an amount. A group's report keeps the "For" attendee.
- The server accepts a line with no description. The printed LR, HR's Request Details and Finance's views show the expense type.
- Attendees choose from: Registration Fee (new), Meals, Accommodation, Transportation (see R3), Materials, Miscellaneous. Venue Rental and Speaker Fees are for HR's program-wide entries only.
- Reports already filed keep their stored descriptions, and they still print. The stored field stays.
- Keep every money rule: totals in centavos, the cap at the advance, the reimbursement limit, the group's spending cap, line ids for corrections.

### R3. No transportation claim when a vehicle was requested

Said: "transpo 500 pero nag request ka na ng vehicle diba? … idrop down mo yan, tanggalin mo si transpo, gawin mo siyang miscellaneous."

Team's decisions: blocked only while a vehicle request stands for that seminar (anything but Rejected), for the seat or for the group advance that covers it. Otherwise allowed. The employee's own ordinary Vehicle Request counts when its trip overlaps the seminar's dates. A line already on a report may still be raised on a correction, within the advance.

Build:
- The form doesn't offer Transportation, and says why ("You requested vehicle VRS-…; put small fares under Miscellaneous").
- The server refuses a Transportation line (400) on filing and on resubmit.
- Reports filed before this change keep their lines, on resubmit too.

### R4. Certificate of attendance: upload it once, use it three ways

Said: "anong iuupload niyo? … kahit na certificate man lang?" / "ano ang basehan ni hr na umattend na siya ng seminar … dun niyo iuupload yung certificate" / "yung naupload na certificate, yun na din yung magiging proof for liquidation" / "matic naka view." Our notes also say the certificate is "fetched to the division", which we read as the liquidation report and the employee's training records.

Team's decision: the employee submits the certificate to HR after the seminar ends, HR confirms whether they attended, and that opens the liquidation form. HR can't record "Attended" without one. HR uploads it for staff without a Personnel login.

Build:
- **Upload.** Once the seminar has ended, the employee uploads it from their seminar card, and can replace it until HR records attendance. HR or the Administrator can upload it for staff with no Personnel login.
- **HR's basis.** HR's attendance list shows each person's certificate, which opens in the viewer (R6).
- **Proof for the liquidation.** The report includes it automatically, with no second upload. A group's report includes the certificate of every attendee it covers. It appears in the printed LR's attachments and in the Documents Vault.
- **Notices.** HR is told when one arrives, and the link opens the attendance list on that person. If none is on file after the seminar ends, the employee is reminded once (`dedupeKey`).
- **Data.** One stored copy, and the report refers to it. Lists send a `hasFile` flag only, and the file comes through a per-file route.
- **Access.** The employee (their own), HR, the Administrator, and Finance only through the report the certificate supports. Never the Budget Officer. `no-store`. Audit uploads, replacements and officers' views.

### R5. Required documents must actually be required

Said: "pag nag submit ka ng requirement icliclick lang yung requirement? … required yon, hindi pwedeng optional" / "hindi mag momove on yon ng walang attachment" / "wala naman siyang inupload na photo."

Team's decision: seminar photos are not required. The named slots follow the documentary requirements below, which replace the brief's three slots.

Build:
- Named slots. Submit stays disabled, with the reason shown, until the required ones are filled. The server enforces the same on filing and on resubmit.
- Each stored file keeps its kind, so reviewers and the Return checklist can name the missing slot (R7).

**Documentary requirements for an employee, for the liquidation report of a cash advance** (1.2.4 Traveling Expenses, 1.2.4.1 Local Travel, from the team's document). The team highlighted the words below to use as the slots' name plates, and left out the Liquidation Report because that is the form itself.

| As written in the document | Name plate |
|---|---|
| Paper/electronic plane, boat or bus tickets, boarding pass, terminal fee | Tickets |
| Certificate of appearance/attendance | Certificate of Appearance/Attendance (filled from R4) |
| Copy of previously approved itinerary of travel | Itinerary of Travel |
| Revised or supplemental Office Order or any proof supporting the change of schedule | Revised or Supplemental Office Order or Any Proof Supporting the Change of Schedule |
| Revised Itinerary of Travel, if the previous approved itinerary was not followed | Revised Itinerary of Travel |
| Certification by the Head of Agency as to the absolute necessity of the expenses together with the corresponding bills or receipts, if the expenses incurred for official travel exceeded the prescribed rate per day (certification or affidavit of loss shall not be considered as an appropriate replacement for the required hotel/lodging bills and receipts) | Certification by the Head of Agency |
| Liquidation Report | Not a slot |
| Reimbursement Expense Receipt (RER) | RER |
| OR in case of refund of excess cash advance | OR, Excess Cash Advance |
| Certificate of Travel Completed | Certificate of Travel Completed |
| Hotel room/lodging bills with official receipts in the case of official travel to places within 50-kilometer radius from the last city or municipality covered by the Metro Manila Area, or the city or municipality where their permanent official station is located in the case of those outside the Metro Manila Area, if the travel allowances being claimed include the hotel room/lodging rate | Hotel Room/Lodging Bills with Official Receipts, Within 50-Kilometer |

### R6. View files on screen, and print instead of download

Said: "nasan yung liquidation? bakit ko pa idodownload? iprint mo na, pag clinick mo si print tapos print preview."

Team's decision: PDF, JPEG and PNG, 5 MB per file. The suggested cap of 10 files per report was accepted before the named slots came in, so re-check it in Phase 3.

Build:
- A shared file viewer in `src/components/ui/`. PDF, JPEG and PNG preview in a modal with Print and Download. Any other kind can only be downloaded.
- A Print button wherever HR, the Administrator or Finance looks at a report, opening the official LR form in print preview (reuse the modal).
- Security rules that must hold:
  - The allow-list is checked on upload and again before viewing. The data URL's type, the name's extension and the first bytes (`%PDF-`, PNG, JPEG) must agree.
  - Preview from a Blob URL created with the checked type. Images go in `<img>`, PDFs in the browser's PDF viewer. Check Chrome and Edge, because a `sandbox` attribute can block it.
  - Never render HTML, SVG or any other type inline. A blob: page runs in the app's own origin, where the sign-in token sits in localStorage.
  - Keep `SAFE_FILE_URL` / `documentProblem` as the check every file must pass.

### R7. A missing-document notice that opens on the missing document

Said: "dapat meron din system notification yan … tapos ma reredirect siya don" / "pag nag click ako, ma reredirect na siya sa missing document, hindi ko na hahanapin … wag mo na ako pahirapan."

Build:
- A target on `NotificationLink` (e.g. `focus`). When HR or Finance returns a report asking for a missing or replacement file, or reopens any item (the first one if several), the portal scrolls to that exact slot, outlines it, shows the reviewer's note and puts the keyboard focus on its upload button.
- The notice names the document.
- The certificate reminder (R4) opens on the card's upload the same way.
- It works from the bell and from the portal's own "Notifications & Alerts" list.

### R8. Liquidation lists as tables, with a View window

Said: "paano kung 10 yan na liquidation? … patong patong? pwede ba itable format mo yan?" / "1000 na liquidation yan, anya itsura nan?" / "meron akong view dito tapos lalabas yun sa separate na ano, hindi ako aakyat" / "dapat ma view mo yung detalye."

Build (with the `ui-designer` agent):
- Finance's queue becomes a table: report no., employee ("group of N" when grouped), seminar, claim type, advance, spent, refund/balance, date filed, stage. Search, the existing claim-type filter, sorting, 25 rows per page.
- View opens a modal with the lines, the files and certificates (in the viewer), the advance, the history, and Validate / Return / Print. Nobody scrolls back up.
- The Liquidations Index rows open the same View. So does the portal's settlement log, as a table.
- Cash Advance Requests and the Reimbursement Queue also stack as cards, so they get the same treatment. Check the other lists.
- Keep notice deep links, the self-approval warnings, the Return checklist and focus handling (`ui/ModalDialog.tsx`, `useRecordHighlight`). Newest first is the instructor's rule for request lists.

### R9. The TDP is uploaded once a year, and seminars come from it

Said: "pag naka upload na … tanggalin niyo na [yung upload TDP sa taas] kasi minsanan lang … may button dito na TDP na uploaded … dito ka ngayon mag rerequest ng training … naka base kay TDP … yung nasa baba, ilipat niyo sa isang button" / "hindi kayo mag aadd jan ng training."

Reading of 29:30–29:50, confirmed by the team: uploading is a once-a-year job, so after the upload the panel at the top goes away. A button showing the TDP is uploaded takes its place, and the big Plan A table moves behind a button. Nobody types trainings into that table. HR sets up a training starting from the TDP instead of a typed title.

Team's decisions: **"Add Training Program" stays and is not replaced.** Needs are added only through an amended TDP.

Build:
- **Record the upload.** For each fiscal year: the file name, who, when, and how many needs and employees. A new collection with a load default, written by the import's commit route.
- **Training Needs.** With no TDP for the year, the upload panel shows as it does today. Once uploaded, a bar reads "TDP for FY 2027 uploaded ✓ (file · date · by)", with "View uploaded TDP", which opens Plan A read-only.
- **Replace with an amended TDP.** HR and the Administrator only, with a confirmation and an audit entry. A second import today only adds and never removes, so this is new work. Seminar links and Monitoring match needs by title, so a replace must not leave them pointing at nothing.
- **Keep working:** the Mandated trainings panel, and Monitoring's accomplished override, which uses the same route as editing a need.
- **Programs & Budget.** Keep "Other training (not in the TDP)" as the exception, through the existing justification dialog (HSAC answer 8, 12z Part C). If no TDP has been uploaded, say so and link to Training Needs.

### R10. A participant picker that suggests the right people and shows who already went

Said: "dapat may history kayo … nakikita niyo yung mga na isend na na empleyado, kung meron na siya dapat hindi na siya mag ddrop down jaan … yung mga may training na hindi na siya yung priority" / "suggestive … mga empleyado na hindi pa nakaka attend ng training, sila lang yung makikita ninyo."

Build:
- **Already sent.** Anyone listed as "Not eligible" today leaves the selectable list, for a collapsed read-only "Already sent to this training (N)" showing who went and when. People already ticked for this seminar stay as they are.
- **Default view.** Only people with no training yet this fiscal year, inside the Plan A switch (see the decisions above).
- **Already trained this FY.** Behind a toggle, "Already trained this FY (N)", still selectable. 12s allows more than one training a year.
- **History link.** Each row links to that person's trainings (R11).
- **Unchanged:** the server's ranking, the TDP justification, the division warning, the mandated order.

### R11. Training history per employee, and training reports

Said: "kung chineck ko si test account, makikita ko yung history … with specific details" / "kaya niyo gawin yung reports non individual? … history per employee, per training, for the fiscal year 2027" / "generated reports yung mga training programs na natapos na, present up to oldest."

Team's decision: HR and the Administrator see the reports and histories, Finance only the liquidation side, not the Budget Officer.

Build:
- **One Employee Training History view, reused everywhere.** Every seminar and training with its fiscal year, title, dates, venue, hours, facilitator or organizer and attendance, plus the certificate (in the viewer), the cash advance (amount, DV) and the liquidation (report no., status, spent, refund). It opens from Trainings and Seminar, the picker's "History" link and the employee's PDS. Employees see their own.
- **A "Training" section in Generated Reports,** beside the existing Plan D card, for HR and the Administrator only, with role checks on new GET routes and `no-store`:
  1. Employee Training History: one employee, for one fiscal year or all years.
  2. Training Program Report: one seminar, with participants, attendance, certificates on file, advance and liquidation status, totals.
  3. Completed Training Programs: a year's finished seminars, newest first, with title, dates, venue, hours, enrolled and attended, allocated and spent.
  4. Employees with no training yet: for one fiscal year (reuse the coverage route).
- **Output.** A table on screen, Print (a print preview with the HSAC header, like `training/PlanHeader.tsx`) and CSV (`downloadCSV`). These CSVs will carry typed text such as the venue, so neutralise spreadsheet formulas the way `csvCell` in `training/planD/planDRows.ts` does (security review, 2026-11-01).
- **Money.** From what already computes it (`seminarBudget`, the reports' own totals), rounded to centavos. Don't calculate it a second way.
- **Fix HR's add-training form.** It sends `date_conducted`, `training_hours` and `certificate_file_name`, which the server ignores, so every record gets 8 hours and no date.

### R12. Demo data for the final defense (not code)

Said: "dapat nag add kayo ng mga empleyado sa defense niyo." In the demo, the test account had been sent to every seminar.

Propose how to get realistic data: more employees with Personnel logins, Plan A entries, and seminars across the year with history. Either through the app's screens, or a documented seed that can be re-run into a separate demo copy. Never edit the live `data_store.json` without the team's explicit OK, and no one-off scripts.

## Guardrails for every phase

- Don't break the money rules (12q, `src/liquidationMoney.ts`, `src/reimbursement.ts`, the group's spending cap), the correction flow (lines by id, the file history), group advances (`src/advanceCoverage.ts`), the TDP rules (12z), division coverage (12x), office hours (12u), or notifications (`notify()` with `link`, read state per person).
- Every new or changed route: a server-side role check, an ownership check for employee data, `transactional` where money or attendance moves, `logEvent`, the response envelope, and 400/403/404/409.
- Certificates and receipts are personal data: the allow-list, the size limit, one stored copy, `no-store`, audit entries for views.
- New rules get unit tests, including which documents a report needs and which expense types a seat may claim. `npm test` passes, and `npm run lint` has no new errors.
- Test on a sandbox copy of the data with API and browser checks. Older suites stay at their usual results.
- FastAPI has none of this: record the gap in known-issues item 11, don't build it.
