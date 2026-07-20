# Seven Seas — Project Handover

*Keep this file up to date. When a Claude conversation runs out of context, a fresh
session should be able to read this file and pick up exactly where things left off.*

Last updated: 2026-07-20

---

## What this is

Seven Seas — a single-file web app for dive shops, charter boats, and yacht operators
(checklists, waivers, bookings, crew, gear inventory, fleet maintenance, cash-up, etc.),
built for Fran, who has no coding background. Claude writes 100% of the code.

- App code: `index.html` (one big file, ~11k lines — HTML + CSS + JS, no build step)
- Service worker: `sw.js` (PWA offline app-shell caching)
- Marketing site: `landing.html`
- Backend: Supabase (Postgres + Auth + Storage + Edge Functions)
- Email: Resend, called from two Supabase Edge Functions
  (`supabase/functions/send-staff-invite`, `supabase/functions/send-booking-confirmation`)
- Hosting: Render, auto-deploys on every push to the `main` branch on GitHub
  (`https://github.com/francoroca70-ux/dive-app-v2`)
- Live URL: `https://dive-app-v2.onrender.com/`

## Workflow — how Claude and Fran work together

**Claude edits the real files directly.** Claude has Read/Edit access to this folder
(`C:\Users\franc\dive-app-v2`) and makes changes straight to `index.html` etc. with its
own tools. Fran does not need to copy/paste code blocks back and forth — that old
pattern is gone. Claude also runs `git add` / `git commit` itself from its sandboxed
shell.

**Fran's part is just `git push`.** Claude's sandbox has no stored GitHub login, so
`git push` fails from Claude's side (`could not read Username for 'https://github.com'`).
After Claude commits, Fran runs this once from his own Git Bash terminal in the project
folder:

```
git push
```

That's the only manual step. Render picks up the push automatically and redeploys
(usually live within a minute or two).

**Known quirk — stuck git lock files.** Occasionally `.git/index.lock` or
`.git/HEAD.lock` gets left behind and blocks all git commands with
`Unable to create index.lock: File exists`. Claude's sandbox cannot delete these
(`Operation not permitted` — likely a Windows-side handle via the mounted folder).
Fran can always delete them from his own terminal:

```
rm -f .git/index.lock .git/HEAD.lock
```

Then retry `git add` / `git commit` / `git push` as normal.

## Standing rule: everything is bilingual

Every user-facing string goes through the `TRANSLATIONS` object (`en:` / `es:` blocks)
+ `t(key)` + `data-i18n` / `data-i18n-placeholder` attributes. Dynamic content re-renders
on language switch via `refreshDynamicTranslations()`. After any batch of new UI text,
verify the `en`/`es` key counts match with Grep before calling it done.

## Current known issue: staff invite emails

**Symptom:** Fran invites a crew member from Settings → Crew → Staff. The invite is
created, but the email never arrives — the UI just shows the invite sitting in
"Pending invites" with a "Pending" badge.

**Important:** "Pending" in that list means *not yet accepted by the invitee* — it is
not an email-delivery indicator. It will say "Pending" whether the email sent
successfully or not, which is why this looked like nothing was happening.

**Root cause (very likely):** `send-staff-invite` and `send-booking-confirmation`
both send through Resend. Without a `RESEND_FROM_EMAIL` secret set to a domain
verified in Resend, they fall back to Resend's sandbox sender
(`onboarding@resend.dev`), which Resend restricts to only deliver to the Resend
account owner's own email — not to arbitrary staff/guest addresses. This ties
directly to the still-pending Google Workspace domain setup (task: buy/verify
a domain, set it up in Workspace, verify it in Resend).

**Interim workaround already shipped:** a "Copy link" button next to each pending
invite (Settings → Crew → Staff → Pending invites) copies the invite URL to the
clipboard so Fran can send it manually (WhatsApp, personal email, etc.) without
waiting on Resend/domain setup. Live as of commit `902aa1b`.

**Next diagnostic step, when picking this back up:** check the Supabase dashboard →
Edge Functions → `send-staff-invite` → Logs for the actual error on a failed send.
That will say definitively whether it's a missing `RESEND_API_KEY` secret (500,
"RESEND_API_KEY secret is not set") or a Resend-side rejection of the sandbox
sender (502 with Resend's error body) — Claude cannot see Supabase secrets or
function logs directly, so this check has to come from Fran's own Supabase dashboard.

**Real fix (blocked on Fran):** once the Workspace domain is live —
1. Verify the domain in Resend.
2. Set `RESEND_FROM_EMAIL` (e.g. `hello@sevenseasops.com` or whatever domain/address
   Fran lands on) as a Supabase Edge Function secret.
3. Confirm `RESEND_API_KEY` is set too (should already be, since booking confirmations
   were built earlier — but worth double-checking in the same dashboard screen).

That one secret change fixes both invite emails and booking-confirmation emails at once.

## Business context (see also: Claude.ai project knowledge, "DIve app" project)

Goal: $1,500/mo passive-ish income within 7–8 months. Dive Platform App is the main
project, built in tiers (Tier 1 in progress/mostly done, Tier 2/3 not started). Full
business context, income projections, and schedule live in the Claude.ai project's
custom instructions — not duplicated here to avoid drift; treat that as the source of
truth for business strategy, this file as the source of truth for engineering state.

## App launch checklist — Google Play / Apple App Store

*This is the durable version of the launch punch list — the in-chat task widget
resets each session and only shows that session's work, so treat this section as
the real source of truth. Full detail/reasoning for each item lives in
`App-Store-Roadmap.md`.*

**Done:**
- [x] PWA foundation — manifest, service worker, full icon set generated from the
  trident mark (Phase 0)
- [x] Capacitor wrap — `android/` and `ios/` native projects generated (Phase 2)
- [x] CI pipeline green — GitHub Actions builds an installable Android debug
  `.apk` and an iOS Simulator build automatically on every push (`MOBILE.md`)
- [x] Researched privacy policy generators (Termly, iubenda, TermsFeed,
  FreePrivacyPolicy.com) — see chat history 2026-07-20

**Not done yet:**
- [ ] Register Google Play Developer account ($25 one-time, ~2 business days
  identity verification) — Fran's action, needs a payment method
- [ ] Register Apple Developer Program ($99/yr, individual enrollment is
  fastest) — Fran's action, needs a payment method
- [ ] Start Google Play's mandatory 14-day closed test with 12 testers — the
  single biggest fixed delay in the whole launch, start the moment the Play
  account exists using the Android debug APK CI already produces
- [ ] Set up a cloud Mac build service (Capgo Build / Capawesome Cloud /
  Codemagic) once the Apple account + certificates exist, to get a real signed
  iOS build (CI only produces a Simulator build today, not installable on a
  real iPhone)
- [ ] Finish and publish a real, hosted privacy policy page — pick a generator
  (or a lawyer-drafted one) and get it live at a real URL; both stores reject
  submissions without one
- [ ] Terms of Service page — blocked on the lawyer meeting (see Task #118 below)
- [ ] Store listing assets: screenshots per device size, short + long
  description, age rating questionnaire, category (Business/Productivity)
- [ ] Permanent demo/sample org (sample trips, guests, waivers) for the Apple
  reviewer to click through without real customer data
- [ ] Decide/confirm in-app purchase stance — keeping all billing external
  (Stripe/website, not inside the app) avoids Apple/Google's cut; this is the
  current assumption, just needs confirming before submission
- [ ] Submit both apps for review (Phase 4) — blocked on everything above
- [ ] Optional, not launch-blocking: wire push notifications + camera access
  through Capacitor plugins

## Waiver flow overhaul — remote signing (inspired by Smartwaiver / WaiverForever)

*From the 2026-07-20 brainstorm session. Goal: a guest can sign before they ever
reach the shop, same as Smartwaiver/WaiverForever's link/QR-based flow, instead
of only signing in person on a staff-held tablet like today.*

**How Smartwaiver/WaiverForever actually do this (confirmed 2026-07-20):**
Neither sends a separate private link per person by default. Both use one
shared group/event link tied to the booking — each participant opens the same
link and fills in their own name/signature (a parent can complete several
family members' waivers in one sitting, entering shared info once). A staff
"Event Manager" view shows who in the group has/hasn't signed yet and can send
a targeted reminder to just the people still missing. This matches Seven Seas'
current data model (one `contact_email` per booking group, not one per
participant), so it's the right shape for v1 — no booking-flow change needed
first.

**Not built yet:**
- [ ] Secure public-facing signing page — reachable without any Seven Seas
  login, unlike every other page in the app today
- [ ] One signing token per booking group (not per participant) — lands on a
  page listing everyone in that booking still needing a signature, each
  completed individually on that shared page
- [ ] Token is cryptographically random, not guessable, ideally expiring after
  the trip date or after all participants have signed
- [ ] Extend the `send-booking-confirmation` edge function to generate and
  include the signing link in the confirmation email (currently that email
  has zero waiver content — checked 2026-07-20)
- [ ] Public signing page needs to reuse the existing waiver template/medical
  questionnaire/guardian-minor logic, just authenticated by token instead of
  `sb.auth.getUser()` like the in-app flow
- [ ] A Supabase RLS policy (or edge function using the service role) that
  safely lets a token-holder insert into `waivers` without a real staff login
- [ ] Staff-side status per booking: not sent / sent, awaiting / signed
  remotely / signed in person — per participant, so staff can see at a glance
  who's still missing (the "Event Manager" view, Smartwaiver-style)
- [ ] Targeted reminder — resend the link, or nudge just the specific
  participants who haven't signed yet, not the whole group again
- [ ] Keep in-person signing at check-in working as a fallback for anyone who
  didn't complete it remotely — don't remove the existing tablet flow
- [ ] QR code per trip/booking as a second way into the same shared signing
  page (Smartwaiver/WaiverForever pattern) — useful in person as backup if the
  email didn't arrive or was missed
- [ ] Capture timestamp + IP address on remote signatures for a stronger
  audit trail, matching what established waiver tools already do
- [ ] Confirm existing PDF export covers remotely-signed waivers the same way
  it covers in-person ones
- [ ] Future fast-follow, not v1: WaiverForever also supports collecting
  individual participant emails and sending each their own link — worth
  revisiting once/if the booking flow captures a per-participant email,
  rather than only the one group contact email it has today
- [ ] Bilingual EN/ES on the public signing page (standing rule — same as
  everywhere else in the app)
- [ ] Optional, nice-to-have: reminder email if still unsigned close to the
  trip date

## Recently completed (most recent first)

- Inventory (Gear & Equipment): fixed gear categories silently missing despite
  being active in Settings (backfill seeding gap), fixed a race condition that
  had duplicated Diving/Charter & Yacht/Surf into 2-3 copies each (added a
  unique `(org_id, key)` constraint + idempotent upsert so it can't recur — SQL
  migration `outputs/fix-gear-category-duplicates.sql` shared with Fran to run),
  made category sections and individual gear items collapsible, added a
  "+ Add item" button per category, and fixed the Settings → Operation
  Categories screen so clicking one "+ category" chip no longer looks like it's
  bundling the other not-yet-added categories into one prompt
- Fleet/Gear card layout pass: boat cards optimized for mobile (2-col meta grid,
  ellipsis overflow), engine/compressor cards reorganized (buttons grouped,
  location inline, redundant remaining-hours text removed), recent
  logs/maintenance made expand-on-click instead of always-on-display, Fleet's
  boat search/dropdown/select-all put on one line with the duplicate boat-title
  section removed, "Log Maintenance" split into boat-level vs per-engine actions
- Calendar: fixed "+ New trip" button stretching full-width, fixed Tuesday
  rendering visibly narrower than other day columns in month view (CSS Grid
  `1fr` track auto-sizing gotcha — needed explicit `min-width:0`)
- Capacitor mobile app wrap: `android/` + `ios/` native projects, brand icons/splash
  generated from the trident mark, GitHub Actions CI (`.github/workflows/mobile-build.yml`)
  that builds an installable Android debug APK and an iOS Simulator build automati