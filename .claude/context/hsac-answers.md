# HSAC RAB 1's answers (the office's own rules: cite them when a feature follows one)

Seminar attendance, cash advances, liquidation and refunds. Answered by HSAC RAB 1's Budget unit
on 2026-10-26, and relayed by the team. Each answer is quoted as given, followed by how we read it
and what the system does about it.

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
   - System: Part D, a proposal only: the participant picker would list first the people whose Plan A lists the seminar's needs.
7. **Can the vehicle request be filed together with the cash advance?** (asked by a team member)
   "Yes, pwede."
   - System: Part B (built 2026-10-27, known-issues 12v): "Also request a vehicle" on the cash-advance request, filed in the same step, for the seminar's dates. The two are decided separately: the Division Chief the vehicle, Finance the advance.

Still open: the same or a different budget for each employee (ask HSAC again).
