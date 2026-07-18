# Seven Seas — Project Handover

*Keep this file up to date. When a Claude conversation runs out of context, a fresh
session should be able to read this file and pick up exactly where things left off.*

Last updated: 2026-07-18

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

## Recently completed (most recent first)

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
