# Seven Seas — QA Testing Session (Thursday)

**Scope:** Checklists, Calendar, Waivers.
**Goal:** confirm each feature works as intended AND deliberately try the mistakes real staff would make.

**How to use this:** split up by role below. Each tester works through their own section, checking off the "works" items and actually attempting the "try to break it" items — don't just imagine what would happen. Log anything unexpected in the bug table at the end, even small stuff.

---

## 1. Checklists

### Trip Prep (per-trip gear checklist)

**Confirm it works**
- [ ] **[Instructor]** Open today's trip list — each trip shows the correct guest count and tank count (guests + assigned diving crew × tanks-per-dive, plus 2 spares)
- [ ] **[Instructor]** Check off items on the morning trip, then switch to the afternoon trip — the afternoon checklist starts blank
- [ ] **[Instructor]** Switch back to the morning trip — its checked items are still exactly as you left them
- [ ] **[Instructor]** Sign off a completed checklist with your name — it saves and shows "Done" with your name attached
- [ ] **[Owner / Manager / Captain]** Open "Crew Status" for a trip — see who has and hasn't signed off yet
- [ ] **[All]** Gear is broken down by exact size, not just a headline total (e.g. "3×M, 2×L" wetsuits)

**Try to break it**
- [ ] Try to sign off with items still unchecked — should be blocked
- [ ] Try to sign off with no name typed in — should be blocked
- [ ] Book a mixed trip: one group diving, one group snorkeling on the same boat/time (see Calendar section for setup) — confirm the tank count only includes the diving group + assigned crew, not the snorkelers
- [ ] Add a new guest to a trip after the checklist is already open — refresh and confirm their gear now shows in the totals
- [ ] Remove a guest after their gear was already counted — confirm the totals update down

### Department Routines (Captain / Instructor-DM-Dive Guide / Deck / Stewards)

**Confirm it works**
- [ ] **[Captain]** Complete Morning, End of Day, Monthly, and Yearly routines — each logs separately, with its own history
- [ ] **[Instructor, DM, or Dive Guide]** Same four cadences complete correctly for the Instructor / DM / Dive Guide department
- [ ] **[Deckhand]** Same four cadences complete correctly for the Deck department
- [ ] **[Steward, if staffed]** Same four cadences complete correctly for the new Stewards department
- [ ] **[Owner / Manager / Captain]** Logged Checklists tab shows every completed routine grouped by day
- [ ] **[Owner / Manager / Captain]** Search Logged Checklists by name — results filter correctly
- [ ] **[Owner / Manager / Captain]** Older Vessel Safety Check history (from before this update) still shows up under "Captain — Morning" in the log

**Try to break it**
- [ ] Reset a routine partway through, reload the page — confirm it doesn't silently bring back stale checked items
- [ ] Sign off the same routine twice in one day — see what happens and flag it either way, expected or not
- [ ] Search the log for a name with no matches — confirm a clean "no results" message, not a broken screen

---

## 2. Calendar

**Confirm it works**
- [ ] **[Owner / Manager]** Create a new trip — try saving with the return/arrival time blank, confirm it's blocked
- [ ] **[Owner / Manager]** Create a "shared" booking, add a second group, and set that group's "Activity type" to something different from the trip's default (e.g. trip is "2-Tank Dive", second group set to "Snorkel")
- [ ] **[Owner / Manager]** Add guests to both groups — the diving group sees dive gear fields (BCD, regs, tank size); the snorkel group sees only mask/fins/snorkel
- [ ] **[Owner / Manager]** Print the manifest for that mixed trip — the snorkel group's section shows "Activity: Snorkel" and only its own gear columns, separate from the dive group's
- [ ] **[Owner / Manager]** Book past a boat's stated capacity — the capacity warning shows up
- [ ] **[Owner / Manager]** Multi-day charter trip type — the end date field only appears for multi-day types, and price multiplies by day count

**Try to break it**
- [ ] Try to save a trip with no contact name or phone — confirm it's blocked
- [ ] Try to book a new trip on a past date — confirm it's blocked
- [ ] Double-book the same boat for an overlapping time slot — confirm the conflict warning appears
- [ ] Set a group's Activity type override, then change it back to "Same as trip" — confirm gear fields and pricing revert correctly
- [ ] Delete a trip that has guests and payments logged — confirm everything tied to it is cleaned up, nothing orphaned

---

## 3. Waivers

**Confirm it works**
- [ ] **[Front Desk / Owner / Manager]** Waiver Log — daily/weekly view toggle and prev/next day navigation work
- [ ] **[Front Desk / Owner / Manager]** Search the waiver log by guest name
- [ ] **[Front Desk / Owner / Manager]** Pending-waivers list shows the correct required waiver type per guest — on a mixed dive+snorkel trip, the snorkel group is asked for its own waiver type, not the dive group's
- [ ] **[Front Desk / Owner / Manager]** Mark a waiver signed in-app — the guest disappears from "pending"
- [ ] **[Captain, if elevated]** Export access matches permissions (front desk/owner/manager always; captain only when elevated)
- [ ] **[Owner]** Reports tab (financials) never shows up for any non-owner role, from any page including Waivers or Checklists

**Try to break it**
- [ ] Enter a guest under 18 (date of birth) — confirm the "minor" waiver is required and flagged
- [ ] Sign a waiver for a guest who already signed — confirm nothing duplicates or breaks
- [ ] Open a guest's remote signing link yourself, as if you were them — confirm it only shows their own outstanding waivers
- [ ] If you can force an expired link, open it — confirm a clear "link expired" message rather than a blank page

---

## Bug Log

Fill this in live during the session — even small or "probably nothing" issues are worth a row.

| Role tested as | Area | What happened | Steps to reproduce | Severity |
|---|---|---|---|---|
| | | | | |
| | | | | |
| | | | | |
| | | | | |
| | | | | |
| | | | | |
| | | | | |
| | | | | |
| | | | | |
| | | | | |
