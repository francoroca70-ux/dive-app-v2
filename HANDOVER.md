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

That one secret change fixes invite emails, booking-confirmation emails, and the new
per-guest waiver reminder emails (`send-waiver-reminder`, added 2026-07-20) all at once.
Fran confirmed 2026-07-20 the Workspace domain setup is next on his list ("tomorrow, no
problem") — not started yet as of this writing, so none of these three email flows will
actually deliver to real recipients until it's done. Not blocking further building —
Fran wants to keep going and wire the domain up when he gets to it.

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
- [x] Privacy policy page written and hosted — `privacy.html`, bilingual EN/ES
  (same toggle pattern as `landing.html`), linked from the landing page footer.
  Content accurately describes Seven Seas' real data practices (Supabase,
  Resend, Render, waiver/medical data, minors' data via guardian, no ad
  trackers, no data sales). Explicitly flagged in-page as a placeholder Fran
  will swap for the lawyer-reviewed version once that's ready — confirmed with
  Fran 2026-07-21 this is fine for Google Play's review specifically (Google
  checks the URL works and the content matches actual practices, not who
  drafted it or what tier of generator was used). **Still needs Fran to push
  to GitHub before it's actually live** — built 2026-07-21, not yet deployed.
  Contact email in the page is still the personal Gmail until the
  sevenseasops.com Workspace email is live (see below) — swap it in once that
  exists.

**Done (2026-07-21):**
- [x] Bought `sevenseasops.com`, set up Google Workspace (Business Starter,
  monthly billing, not annual) — one paid mailbox `franco@sevenseasops.com`,
  plus free aliases `contact@sevenseasops.com` and `bookings@sevenseasops.com`
  on that same mailbox (no extra seats needed). `bookings@` matches the
  address already referenced as `RESEND_FROM_EMAIL` in the edge functions.
  Updated `landing.html` and `privacy.html` — every `francoroca70@gmail.com`
  reference swapped to `contact@sevenseasops.com` (mailto links, footer,
  privacy policy contact section).

**Still to do on this:**
- [ ] Verify `sevenseasops.com` in Resend, then set `RESEND_FROM_EMAIL` to
  `bookings@sevenseasops.com` as a Supabase Edge Function secret — this is the
  fix for the staff-invite/booking-confirmation/waiver-reminder email delivery
  issue described earlier in this file. Fran's action (Resend dashboard +
  Supabase dashboard, not something Claude can do remotely).
- [ ] Update each org's contact email in Settings (currently whatever each demo
  org has saved) to use `contact@sevenseasops.com` where it makes sense.

**In progress (started 2026-07-21):**
- [ ] Register Google Play Developer account ($25 one-time, ~2 business days
  identity verification) — Fran started this today.
- [ ] Recruit 12+ testers for the closed test — Fran starting to reach out
  today so the 14-day clock can start the moment the Play account clears.
  Reminder for next session: the 14 days are literal consecutive calendar
  days, not variable, and testers need to actually open/use the app somewhat
  regularly (not just install it once) — Google flags testers as invalid if
  they "did not actively test the app daily." Invite more than 12 if possible
  since some people drop off, and the count needs to stay at ≥12 actively
  opted-in for the full 14 days.

**Not done yet:**
- [ ] Register Apple Developer Program ($99/yr, individual enrollment is
  fastest) — Fran's action, waiting on his card to work again (a few days out
  as of 2026-07-21)
- [ ] Set up a cloud Mac build service (Capgo Build / Capawesome Cloud /
  Codemagic) once the Apple account + certificates exist, to get a real signed
  iOS build (CI only produces a Simulator build today, not installable on a
  real iPhone)
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

*Built 2026-07-20. Guests can now sign before they ever reach the shop, same as
Smartwaiver/WaiverForever's link/QR-based flow, instead of only signing in
person on a staff-held tablet.*

**Architecture:** one shared signing link per booking group (not per guest) —
matches how Smartwaiver's Events/WaiverForever's group requests work, and
Seven Seas' data model (one `contact_email` per booking, not one per
participant). The public signing page never touches `waivers` /
`participants` / `trip_groups` / `waiver_templates` directly with the anon
key — everything goes through the new `waiver-remote-signing` edge function,
which uses the service role key and re-validates the token on every call. This
was a deliberate choice over opening new RLS policies on those tables to
anon, given the medical/health data involved.

**New pieces:**
- `waiver_signing_links` table (org_id, group_id, token, expires_at) — RLS
  only allows authenticated staff of the matching org to insert/select; the
  public page never queries it directly, only via the edge function
- `waivers` table gained `signed_via` ('staff'|'remote'), `signer_ip`,
  `signer_user_agent` — additive, nullable, nothing existing broke
- New edge function `supabase/functions/waiver-remote-signing/index.ts` — three
  actions: `status` (group + participants + required/signed waiver types),
  `template` (wording or medical questionnaire for one waiver type, fetched on
  demand), `sign` (validates participant belongs to the token's group, inserts
  into `waivers`, captures IP/user-agent)
- `send-booking-confirmation` edge function now accepts `waiverLink` and shows
  a "Sign waiver(s)" button in the email when present
- `index.html`: new pre-auth screen `screen-sign-waivers`, reached via
  `?waiver=TOKEN` (same pattern as the existing `?invite=TOKEN` staff-invite
  flow) — participant list, per-type sign forms reusing the existing signature
  canvas/medical questionnaire pattern under new `rw-` prefixed element IDs so
  nothing collides with the authenticated in-app modal
- `getOrCreateWaiverSigningLink(groupId, tripDate)` — creates the token
  (expires ~3 days after the trip) or reuses an existing one; wired into
  `sendBookingConfirmationIfNeeded()`
- Settings → Waivers page: new "Remote Signing — Today's Bookings" card,
  Event-Manager-style — per booking group, who's signed vs. missing what, plus
  a Copy Link button (same manual-share pattern as the existing staff-invite
  copy-link workaround, useful right now since Resend/domain isn't live yet)
- In-person signing at check-in is untouched — remote signing is additive,
  not a replacement

**Added 2026-07-20 (same day, follow-up round): per-guest reminder + QR code**
- Each missing guest in the "Remote Signing" card now gets its own "Remind"
  button (not just a group-level Copy Link) — since Seven Seas still only has
  one `contact_email` per booking group, this emails the group's contact but
  names the specific guest who's still missing a waiver, so staff can nudge
  one person without re-sending the whole group's confirmation
- New edge function `supabase/functions/send-waiver-reminder/index.ts` —
  same Resend pattern as `send-booking-confirmation`, sends the targeted
  reminder email. Blocked on the same Resend/domain fix above until real
  delivery works.
- "Show QR" button next to Copy Link opens a modal with a scannable QR code
  for the same shared group link (`modal-waiver-qr` in index.html) — a second,
  no-typing way in for check-in desks/boat printouts. Rendered client-side via
  the `qrcode` CDN library (`cdn.jsdelivr.net/npm/qrcode@1.5.3`), no new table
  or edge function needed.
- Explicit decision from Fran (2026-07-20): individual per-participant links
  are NOT wanted — the shared group-link model stays as-is.

**Still needs the SQL migration run before it works —** see
`outputs/remote-waiver-signing-migration.sql` shared in chat 2026-07-20; run
it in Supabase → SQL Editor before this can go live. Also needs the new
`send-waiver-reminder` edge function deployed via the Supabase dashboard
(same manual-paste process as the other two functions) before the Remind
button will work.

**Known limitations / fast-follows, not blocking:**
- Individual per-participant links (WaiverForever also supports this) would
  need the booking flow to capture an email per guest first — explicitly
  decided against this for now (see above), not today's data model anyway
- PDF export wasn't specifically re-tested against remotely-signed waivers,
  though it reads from the same `waivers` table so should already work
- QR code and reminder email are both still blocked on real Resend/domain
  delivery for the reminder path specifically; the QR path doesn't need email
  at all and works today

## Recently completed (most recent first)

- Per-guest waiver "Remind" button + QR code as a second way into the shared
  group signing link (see "Waiver flow overhaul" section above) — new
  `send-waiver-reminder` edge function (not yet deployed), no new table for
  the QR code (client-side render only)
- Remote waiver signing built end-to-end (see the section above for full
  detail): new `waiver_signing_links` table + audit columns on `waivers`, new
  `waiver-remote-signing` edge function, public no-login signing page in
  index.html, booking-confirmation email now includes a signing link, staff-
  side group signing status + copy-link on the Waivers page. Needs
  `outputs/remote-waiver-signing-migration.sql` run in Supabase before it's live.
- Trip manifest (`printManifest()`) now shows a Waivers column per guest and a
  per-group summary — clearly flags who's missing which waiver type(s), only
  shown when waivers are enabled for the org

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
  that builds an installable Android debug APK and an iOS Simulator build automatically
  in the cloud — no local Android Studio/Mac needed. Full details in `MOBILE.md`.
  Note: the sandbox this was built in has a permissions quirk where files can be
  created/edited but not deleted/renamed (same as the recurring git-lock-file issue) —
  a couple of harmless leftover template files exist as a result (documented in the
  commit), don't be alarmed if `git status`/a fresh clone shows a stray
  `com/getcapacitor/myapp/` Java file under `android/` — it's unused dead code, not a bug.
- Fixed multi-day trips being undercounted/missing on Home stats + shop-switch now
  jumps to Home automatically so the switch is obvious
- Crew day-rate save failures now surface the real Supabase error instead of a generic
  message — confirmed genuinely blocked (not a false alarm), likely an RLS policy gap
  on the `staff` table for updating other members' rows — waiting on Fran to share the
  current RLS policy screenshot before writing the fix
- Fixed inconsistent gear fields across diving trip types (Shore Dive etc. were
  missing Mask/Tank/Computer) + added a "Gear fields" self-serve editor in Settings →
  Trip Types so this class of bug is fixable without a code change going forward
  (`toggleGearFieldsPanel()`)
- Deployed `send-staff-invite` Supabase Edge Function (was coded but never actually
  deployed — that was the real root cause of invite emails silently failing, separate
  from the Resend sandbox-sender issue below)
- Copy-invite-link button + autocomplete/password-manager-popup suppression on the
  invite form
- Translated the Add Guest form and all equipment/gear dropdowns to Spanish
- "Remember me" login option + blocked bookings dated/timed in the past
- Lawyer consultation prep doc (`legal/`, EN + ES) covering entity structure,
  liability/waivers, subscription billing compliance, data privacy, IP, insurance
- Recommended Stripe Billing (not Paddle/Lemon Squeezy) for shop subscriptions —
  reasoning in chat history; task #148 tracks the actual build, blocked on Fran
  creating a Stripe account first
- Translated all seed gear item names + size labels (55 items)
- Editable/deactivatable Operation Categories in Settings
- Fixed booking price bug: multi-day and private-boat trips weren't multiplying
  price by day count; introduced `currentTripPricingQty()` / `currentTripPriceLabel()`
  shared helpers used consistently across booking modal, calendar, guest tabs
- Built `landing.html`: real logo, bilingual EN/ES, functional CTAs, no emoji,
  About/FAQ/Contact sections, favicon
- Mobile nav fixes (sign-out button visibility), branded wordmark logo in nav

## Open items worth knowing about

- Task #118 (lawyer meeting — ToS/Privacy/waiver e-signature/business entity) is
  blocking real Privacy/Terms page content and full waiver-legal testing.
- Task #146 (Seven Seas Google Workspace account) is blocked on Fran; unblocks the
  Resend fix above once done.
- A round of end-to-end tests hasn't been run yet: crew invite flow, multi-day +
  crew-hire booking, offline mode, EN/ES toggle across all pages.
- **Test the remote waiver signing feature end-to-end before Friday (2026-07-24)** —
  needs the SQL migration run + both edge functions (`waiver-remote-signing`,
  `send-waiver-reminder`) deployed first (see "Waiver flow overhaul" section
  above). Test: the `?waiver=TOKEN` public link opens and lists participants,
  signing a waiver actually saves to `waivers` with `signed_via: 'remote'`,
  the staff Waivers page shows correct signed/missing status per group, the
  Show QR button renders a scannable code, and the Remind button (email
  delivery won't actually arrive until the Resend/domain fix is done — but the
  button should still hit the edge function without erroring).
- **Privacy policy is Claude-drafted, not a third-party generator or lawyer-reviewed**
  (decided 2026-07-21 — built directly as `privacy.html` instead of using
  Termly/FreePrivacyPolicy.com). Accurate for what Seven Seas actually collects
  today, fine for Google Play's review requirements, but remember this is a
  placeholder: swap in the lawyer-reviewed version once that's ready. Add this
  as a recurring reminder, not a one-time task.
- **Two bugs mentioned by Fran 2026-07-21 that aren't in this file yet:**
  "Fix calendar showing wrong shop's trips after switching" (no repro details
  captured yet — need to ask Fran what he's seeing, this may or may not be the
  same issue as the already-fixed "shop-switch jumps to Home" / "multi-day
  trips undercounted" bugs) and the crew day-rate RLS save failure (already
  described in the "Recently completed" list below despite not actually being
  fixed — still waiting on Fran's Supabase RLS policy screenshot). Neither
  should be considered resolved just because they dropped off the in-chat task
  widget.
