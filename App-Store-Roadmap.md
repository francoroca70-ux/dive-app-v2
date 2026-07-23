# Seven Seas: Web App → iOS/Android App Store Roadmap

*Prepared July 2026*

---

## The short answer

You don't rebuild the app. You wrap the one you already have. Seven Seas is already a single-file web app talking to Supabase — that's exactly the kind of app this path is built for. Two stages:

**Stage 1 — PWA (Progressive Web App).** Add a manifest + service worker to the existing site. Costs nothing, takes a day or two of Claude's time, no app store approval needed. Android users get a real "Install" prompt and an icon on their home screen immediately. iOS users can "Add to Home Screen" from Safari, but it's a weaker experience there (see iOS caveats below).

**Stage 2 — Capacitor wrap → real App Store / Play Store listing.** Capacitor (by the Ionic team) takes your existing HTML/CSS/JS and wraps it in a thin native shell — same code, but now it's a real, installable, store-listed app with access to native features (push notifications, camera, offline storage) that a browser can't give you. This is the path that gets Seven Seas onto app store search results.

You do **not** need to learn Swift, Kotlin, or rewrite anything. Claude can do essentially all of this the same way we've built everything else — the app stores are a packaging and approval layer on top of code that already exists.

---

## Why this path over a full native rewrite

A full native rewrite (Swift/Kotlin or React Native/Flutter) would mean maintaining two or three codebases in parallel — every feature built twice. Given you're a solo operator using Claude to write all the code, that's not a good trade. Capacitor keeps you at one codebase, one Claude conversation, one place bugs get fixed. The tradeoff: slightly less "native feel" than a from-scratch app, and you're dependent on Capacitor's plugin ecosystem for anything deeply native (which, for an operations tool like this, covers everything you'd realistically need).

---

## Roadmap

### Phase 0 — Foundation work on the current app (no waiting, pure build time)
- Add a **web app manifest** (name, icons, theme color, start URL) and a **service worker** for offline caching — this makes the PWA installable and is also a prerequisite for the Capacitor wrap.
- Generate app icons at all required sizes (iOS needs a full set from 20px to 1024px; Android needs adaptive icons). Claude can generate these from your existing trident logo.
- Review offline behavior — you've already built a real offline queue system for checklists/waivers/tasks, which is a big head start most apps don't have going in.
- Decide on push notifications now if you want them (task list assignments, day-off approvals) — this needs to be wired in at the Capacitor stage, not bolted on later. confirm, build it when is requierd. 

**No waiting time here — this is just build work.**

### Phase 1 — Register developer accounts (the real bottleneck)
This is the part with actual waiting, so start it in parallel with Phase 0, not after.

- **Google Play**: $25 one-time fee. Identity verification takes up to 2 business days. If you're a new personal developer account, Google now requires **12 testers using the app in a closed test for 14 consecutive days** before you're allowed to publish to production. That 14-day clock is the single biggest fixed delay in this whole process — start it as early as possible, even with a barebones build, because you can keep improving the app during those 14 days while the clock runs.
- **Apple Developer Program**: $99/year. If you enroll as an **individual**, approval is typically fast (often same day to a few days). If you enroll as a **business** ("Seven Seas"), Apple requires a D-U-N-S number (a business ID number) which can add 5–10 business days if you don't already have one, plus Apple's own verification (3–5 business days, sometimes 7–10 if they ask for more documents). Apple also offers a $299/year Enterprise Program, but that's for internal-only distribution to your own staff — not relevant unless you specifically don't want Seven Seas publicly listed.

**Recommendation:** enroll as an individual on Apple to start (fast), and register the Google Play account immediately since its 14-day closed-testing clock is unavoidable and non-negotiable. You can always add a business entity to Apple later if needed.

### Phase 2 — Build the native wrapper
- Install Capacitor into the project, point it at your existing web files, and generate the iOS and Android native project shells.
- **Important Windows-specific detail:** building the iOS version normally requires a Mac (Xcode only runs on macOS), which is a real obstacle since you're on Windows. In 2026 this is solved with cloud Mac build services (Capgo Build, Capawesome Cloud, Codemagic are the main ones) — you push your project and get back a signed iOS build without ever touching a physical Mac. This adds a small monthly/per-build cost on top of the Apple fee, but it's the standard workaround now and it's mature.
- Android builds don't have this problem — Android Studio runs fine, or it can also be built entirely in the cloud.
- Wire up push notifications, camera access (useful for your dive log photo upload feature), and offline storage through Capacitor's plugin APIs if you want the fuller native experience.

### Phase 3 — Store listings and assets
Both stores want, before you can submit:
- App icon set (from Phase 0)
- Screenshots for each required device size (phone, and tablet if you support it)
- A short and long description
- A **privacy policy URL** — required by both stores, non-negotiable, especially since you collect guest names, signatures, medical/waiver data. This needs to be a real hosted page, not just a paragraph in the app.
- Age rating questionnaire (both stores ask a set of standard questions)
- Category selection (Business or Productivity fits Seven Seas better than "Sports")

### Phase 4 — Submit for review
- **Google Play**: after your 14-day closed test completes, you submit for production review. Google's review is generally fast, often same-day to a few days for a clean submission.
- **Apple App Store**: submit through App Store Connect. Review time in 2026 typically runs **24 hours to 2–5 days** for a first submission (Apple claims 90%+ reviewed within 24 hours, but new apps and business-category apps often land in the 2–5 day range). Rejections are common on a first pass for minor things (missing privacy policy link, incomplete metadata, demo account not provided) — budget for at least one round of back-and-forth, which can add several more days each time.
- **Apple will ask for a demo login** — have a test org/account ready with sample data so the reviewer can actually click through Seven Seas without needing a real dive shop's credentials.

### Phase 5 — Post-launch
- Updates to an already-approved app review much faster than the first submission (often same-day to 48 hours on iOS).
- Plan a light QA pass on real phones before each submission — TestFlight (iOS) and Play Console's internal testing track (Android) both let you install pre-release builds on your own phone before the public sees them.

---

## Total realistic timeline

| Stage | Time |
|---|---|
| Phase 0 (PWA foundation) | 2–5 days of build time |
| Phase 1 (accounts) — start immediately, runs in parallel | Apple: same day–1 week · Google: 14+ days (hard floor due to testing requirement) |
| Phase 2 (Capacitor wrap + builds) | 1–2 weeks of build time |
| Phase 3 (store assets) | 2–4 days |
| Phase 4 (review) | Apple: 1–5 days (+ possible rejection cycles) · Google: same day–few days |
| **End to end, realistic** | **~3–5 weeks**, mostly gated by Google's mandatory 14-day testing window, not by build effort |

The build work itself (Phases 0 and 2) is maybe 1.5–2.5 weeks of actual Claude+you sessions. The calendar time is longer because of Google's fixed 14-day clock and Apple's identity verification — neither of which you can speed up by working harder, only by starting earlier.

---

## Costs summary

| Item | Cost |
|---|---|
| Apple Developer Program | $99/year |
| Google Play Developer account | $25 one-time |
| Cloud Mac build service (for iOS, since you're on Windows) | Varies by provider — typically a small monthly fee or pay-per-build; check current pricing when you're ready (Capgo Build, Capawesome Cloud, Codemagic are the current options) |
| Apple D-U-N-S number (business enrollment only) | Free, but adds time |

---

## Things to keep in mind

- **iOS PWA limitations**: if you stop at just the PWA (skip Capacitor), iOS "Add to Home Screen" apps got web push notifications starting iOS 16.4, but the experience is still noticeably behind a real native app, and it won't show up in App Store search — dive shops looking for "dive operations app" won't find you. The Capacitor step is what gets you real discoverability.
- **In-app purchases**: if you ever add subscription billing that happens *inside* the app (a shop paying you from within the iOS/Android app itself), Apple and Google both take a cut (up to 30%, though small-business programs reduce this to 15% for developers under $1M/year) and require using their payment systems. If you keep billing external (shops pay you via a website, Stripe, invoice, etc., same as most B2B SaaS), this doesn't apply — worth deciding early since it affects how "Open Tab" / payment-related screens should behave inside the app vs. what you keep web-only.
- **Privacy policy is not optional** — given you handle guest names, signatures, medical/waiver data, and contact info, both stores will reject a submission without a real, accessible privacy policy page. This should be written and hosted before you get to Phase 3.
- **Demo account for reviewers** — keep a permanent "demo shop" org with sample trips/guests/waivers so Apple's reviewer (a real person) can actually use the app without your real customers' data.
- **You can develop and test entirely without paying anything** — the $99/$25 fees are only required when you're ready to actually submit to the stores, not during development. No need to pay early.
- **Existing offline-queue work pays off here** — most teams building a "PWA-to-app" migration have to retrofit offline support from scratch; you already built it for a different reason (dive shop wifi), and it directly strengthens the app store version.

---

## Suggested order of operations for you

1. Say the word and Claude builds the PWA manifest + service worker + icon set (Phase 0) — no cost, no waiting, can start today.
2. In parallel, register the Google Play account ($25) and start the 12-tester closed test the moment there's an installable build — this is the part that costs you calendar time, so it should start as early as possible even with a rough build.
3. Register Apple Developer Program ($99) as an individual to start fast.
4. Claude sets up Capacitor and (via a cloud Mac build service) produces installable iOS/Android builds.
5. Write the privacy policy page and store assets.
6. Submit both, handle any rejection feedback, launch.
