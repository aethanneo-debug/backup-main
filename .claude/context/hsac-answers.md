# HSAC RAB 1's answers (the office's own rules: cite them when a feature follows one)

Seminar attendance, cash advances, liquidation and refunds. Answers 1–7 were given by HSAC RAB 1's
Budget unit on 2026-10-26, answer 8 by HSAC RAB 1 on 2026-10-28; all were relayed by the team. Each
answer is quoted as given, followed by how we read it and what the system does about it.

1. **If 2 or more employees are set to attend the same TDP seminar, do they attend at the same time?**
   "Depends if: a. same division – rule is someone must stay to man the division; b. availability of funds – kaya ba ng sabay-sabay?"
   - Reading: on every day of a seminar, each division keeps at least one person at the office. And the money has to allow sending them together.
   - System: division coverage (built 2026-10-27, known-issues 12x): a seminar that would leave a division with nobody at the office on a weekday is refused unless HR confirms it, which is recorded; the participant picker warns as people are chosen. The funds side is the existing ceilings: seats, the seminar's allocation and the year's Unallocated.
2. **Does one person process and receive the cash advance (CA) for everyone, or does each employee get their own? Same budget for each, or different?**
   "Yes, if sabay-sabay pwedeng iisa na lang ang mag-process ng CA."
   - Reading: when they attend together, one person may process one CA for the group. The budget-per-employee part was **not answered**: every participant keeps allocation ÷ seats until HSAC answers it.
   - System: the group cash advance (12v, Part A): one advance, released to one participant (the holder), covering several participants of the same seminar.
3. **One liquidation report (LR) each, or one for the group?**
   "Rule: if iisang CA – iisang LR lang. If 5 separate CA, 5 separate LR. Practice: if sabay-sabay ang attendees, 1 CA, 1 LR."
   - Reading: one LR per CA. Both ways are valid; attending together, the usual practice is one CA and one LR.
   - System: individual advances (each attendee files their own report) and group advances (the holder files one report for the group).
4. **Leftover cash: refunded by each employee, or once for all?**
   "Same process, refund as one if processed as one."
   - System: a group's leftover is handed back once, with one OR, recorded at Finance's validation (`fundReturn`). If nobody covered attended, the holder refunds the whole advance once.
5. **Can an employee get a new CA before liquidating the previous one?**
   "No."
   - System: `openAdvanceElsewhere` (since 2026-10-23, known-issues 12s; COA Circular No. 97-002). For a group advance it applies to the holder, who is accountable for the cash.
6. **RA 12009 (New Government Procurement Act) training** is for BAC members. The Admin Officer IV needs it because procurement is an inherent function of the position: Plan A's "Needed Training for the Function" column. Others, e.g. Budget staff who are BAC TWG members, hold TWG as an additional designation, so for them it is an additional function: the "Needed Training for Additional Function/Designation" column.
   - Reading: Plan A's columns already say who needs a training and why, so no designation field is needed.
   - System: Part D (built 2026-10-27, known-issues 12y): for a seminar that covers Plan A needs, the participant picker lists the people whose plan lists one of them and names the column ("Needs this: Function" or "…: Additional Function/Designation"); "Show all employees" covers the exceptions.
7. **Can the vehicle request be filed together with the cash advance?** (asked by a team member)
   "Yes, pwede."
   - System: Part B (built 2026-10-27, known-issues 12v): "Also request a vehicle" on the cash-advance request, filed in the same step, for the seminar's dates. The two are decided separately: the Division Chief the vehicle, Finance the advance.

8. **How HR builds the TDP, and who goes to a seminar** (2026-10-28): "Paano po yung whole process ng HR sa paggawa ng TDP hanggang sa pag-set ng seminar, and bakit po napupunta yung specific seminar na yon sa employee? And sa selection po ng participants sa seminar, for example Legal Ethics, may mapi-prioritize po ba na employee for that seminar, and pwede po ba mag-assign ng specific employee kahit hindi siya under Legal Division?"
   1. Position Description Form (PDF) & Qualification Standards (QS) Review
      a. HR examines DBM-CSC Form No. 1 (PDF) for all plantilla positions to inventory specific duties, functional tasks.
      b. HR cross-references position titles with the CSC Qualification Standards to identify mandatory minimum training hours (e.g., 40 hours of supervisory training for Division Chiefs, specialized IT hours for technical tracks).
   2. Special Orders (SO) & Committee Designations
      a. Bids and Awards Committee (BAC), Secretariat, & TWG – requires specialized training on Republic Act No. 12009.
      b. Internal Quality Audit (IQA) / QMS Team – requires ISO 9001:2015 Quality Management System internal auditing.
      c. Gender and Development (GAD) Focal Point System – requires GAD Mainstreaming, Harmonized Gender and Development Guidelines (HGDG), and Safe Spaces Act training.
      d. Occupational Safety and Health (OSH) Committee – requires Basic Occupational Safety and Health (BOSH) or Disaster Risk Reduction and Management (DRRM) training.
      e. Discipline, Grievance, or Fact-Finding Committees – requires administrative due process, investigation techniques, and public sector ethics training.
   3. Competency Assessment & Performance Gap Analysis
      a. Post-Evaluation Forms – is the training effective?
      b. Individual Learning Report – did she/he learn something?
      c. Individual Performance Commitment and Review (IPCR) – did she/he apply the learnings in her/his work?
   4. Training Needs Analysis (TNA) – A, B, C: core tasks specified in the PDF and QS requirements for promotion; specific requirements for BAC, ISO/IQA, GAD; mandatory government-wide requirements (e.g., Ease of Doing Business/ARTA, COA compliance, Code of Conduct/R.A. 6713).
   5. Prioritization – statutory/legal mandates.
   6. Drafting, review of CAO, approval from CRA.

   "As much as possible if hindi identified sa Training and Development Plan, yung title ng training or personnel, hindi pwede. Pero di naman tayo strict doon. Case to case basis pa din siya. Unless may justification na, designated siya na gumawa ng tasks. Meron pa din kasing power ang chief, or head of agency kung sino ang identify nila na mag-attend ng training. For example, naka-leave si accountant, at may paid training by central office, need mag-identify ng representative in lieu of the accountant. Kasi sayang yung budget allotted."
   - Reading:
     - The TDP decides both the training and the person. Steps 1–6 are how HR prepares it, outside the system (the CAO reviews it and the CRA approves it); the approved plan reaches the system through the Plan A import.
     - Anyone or any training the TDP doesn't identify is the exception, allowed case to case with a justification: designated to do the tasks, or identified by the Chief or head of agency (e.g. a representative in lieu of an accountant on leave, so a paid slot isn't wasted).
     - Legal Ethics: the plan decides, not the division. Plan A lists it for both Legal Assistant II in the Office of the Chief Regional Adjudicator and the HHRO III and HHRO I in the Legal Division, not the attorneys.
   - System (known-issues 12z):
     - Part A (built 2026-10-28): someone the TDP doesn't identify for a seminar (their own Plan A for its year lists none of its needs) is seated only with a recorded justification: the kind (designated to a committee from the list above, identified by the Chief, or another reason), the reason and who identified them. HR and the Administrator alone see it, and the Administrator is told.
     - Part C (built 2026-10-29): a seminar the TDP doesn't identify (none of its needs is in its year's Plan A) is held only with its own justification: why (a Central Office training, an invitation from another agency, a new law or issuance, or another reason), the reason and who approved it. It covers everyone seated on it. HR and the Administrator alone see it, and the Administrator is told.
     - Part B (built 2026-10-29): HR can send a representative in lieu of someone enrolled, as in HSAC's example. The original's enrolment is closed and they are told; the representative takes the seat with a justification "In lieu of" them (the reason and who identified them). Cash advanced to the original is settled first, and Finance can now record a refund before the seminar starts.
     - Step 5, prioritization by statutory or legal mandate (built 2026-10-29, Part D): HR or the Administrator marks a training title as mandated, with the law or rule behind it, once for every year. Its unmet needs then come first in Monitoring, in planning and among the participant picker's Plan A listers. A mark orders only: it never changes who may be seated or what counts as accomplished. Nothing is marked to start with; HSAC's own examples (R.A. 6713, ARTA, R.A. 12009, COA, Safe Spaces, GAD, OSH, DRRM) are offered as suggestions.
     - Steps 1–3 and 6 are proposals (Part D).

Still open: the same or a different budget for each employee (ask HSAC again).
