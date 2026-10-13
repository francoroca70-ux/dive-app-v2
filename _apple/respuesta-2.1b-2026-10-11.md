# Reply to App Review — Guideline 2.1(b), Information Needed

**Submission ID:** 84a8c50c-621a-4b13-86b0-7edafae99a9c
**Version:** 1.0 (136001) · **Reply to the 8 Oct message** (the 23 Sep one is the old screenshots issue)
**Prepared:** 11 October 2026 · **cut to fit the 4000-character limit**

The status label on the submission page reads `2.1.0 Performance: App
Completeness`; that is the parent of `2.1(b)`, not a second rejection. This
reply answers the five questions as asked.

---

## PASTE FROM HERE

Seven Seas Ops is a B2B operations tool for dive centres and charter operations.
It is not a consumer app and contains no purchasable content.

**1. Who are the users?**

Employees of a dive centre or charter operation that subscribes as a business.
The subscription belongs to the business: one account covers the owner, manager,
captains, instructors, deckhands and front-desk staff. Each signs in with their
own account, created for them by the business by invitation, and uses the app
for daily operations: pre-dive and boat-loading checklists, equipment
inspections, liability waivers, dive logs, scheduling.

No individual consumer buys anything. A staff member cannot purchase, upgrade or
change the business's subscription from any platform, including this app.

**2. Where can users purchase?**

The business subscribes on our website, sevenseasops.com, in a web browser,
before anyone installs the app. Payment is processed by Paddle.com Market Ltd.
as merchant of record. That is the only place a
subscription can be bought — not through the app on any platform, and through no
reseller.

**3. What previously purchased content can be accessed in the app?**

There is no content library and nothing is sold item by item. The subscription
determines capacity only: how many boats and locations the operation may
register, matching the size of the business. Features are identical at every
tier.

A staff member signing in on iOS sees their own operation's data — boats, trips,
checklists, records — created by colleagues on whatever device each uses: a web
browser, Android, or this app, all the same account.

**4. What is unlocked in the app without In-App Purchase?**

Nothing. The app contains no purchase functionality at all: no in-app purchase,
no third-party payment flow, no checkout, no prices, no pricing screen, no buy
button, no link leading to a purchase. Signing in to an account whose business
already subscribes gives access to that business's own operational records,
created by its own employees.

In full transparency: in the build you reviewed, a business whose trial had
lapsed or subscription was cancelled saw a screen listing our three tiers with
prices. That screen was built for the web app and should never have been
reachable in the iOS app. That was our error and it is fixed — the app loads its
interface from our server, so the correction already applies to the build you
have, with no new binary. It now shows no plans, prices or purchase controls,
only a statement that the subscription is not active and that the operation's
administrator manages it on our website. The billing section is gone from the
app on iOS and Android, and notices about a trial ending or a plan limit no
longer link to choosing a plan. Automated tests now fail the build if a price or
purchase control reappears.

We believe this falls under Guideline 3.1.3(c), Enterprise Services: we sell
directly to organisations — dive centres and charter operations — for use by
their employees, and the app lets those employees access what their organisation
already subscribed to. We are glad to adjust anything that falls short here.

**5. How do users obtain an account? Is there a fee?**

No fee, on any platform. Two routes: a business owner creates the operation's
account free of charge and receives a 15-day free trial granted by our
application, with no payment method required; everyone else is invited by their
own operation, sets a password, and never sees a payment step, because the
subscription is the business's. Accounts can be created in the app or on the
web, free in both.

**For your testing:** credentials for an account with an active subscription are
in the App Review Information section. Please use that account — one whose trial
has lapsed is intentionally blocked from the operational screens, which would
prevent you from seeing the app's functionality.

## PASTE TO HERE

---

## Notes for Fran — not for Apple

**Length: 3,892 characters, measured** — not estimated. App Store Connect's
limit is 4,000. Even if it counted every line break as two characters (CRLF),
the worst case is ~3,964, still inside.

My first estimate was "~3,750" and the real count was **4,446**. Measuring is
the only reason this fits. If the field still complains, the quickest safe cut
is the last sentence of answer 4 ("We are glad to adjust…", 53 chars).

Cut from the long draft, with nothing factual lost: the restated question texts,
the repeated "the subscription belongs to the business" framing, the duplicated
"not a consumer app" line, and the closing pleasantries. All five answers, the
admission about the price screen, the 3.1.3(c) framing and the testing note are
intact.

**Don't paste the heading lines `## PASTE FROM HERE` / `## PASTE TO HERE`.**

**Before you send:**

1. **The trial days must say 15 in BOTH listing fields.** The promotional text
   said 14 and the description said 15; the app grants 15. If the edit went the
   other way and both now say 14, the listing understates the product — fix
   before resubmitting. This number has drifted three times; it lives in
   `Datos canónicos` and the listing is the one place the repo cannot check.
2. **Confirm the fix is live:** `https://www.sevenseasops.com/index.html`,
   console says `build 2026-10-11f`. Done and verified 11/10. The native app
   pulls its interface from the same place, so the reviewer's existing build
   (`136001`) has the fix. **No new binary for this.**
3. **Check the screenshots are still in the version before redoing them.**
   Metadata is not wiped by a rejection; the ones prepared for the 30/09
   submission should still be in their slots.
4. **App Review Information already has demo credentials** for
   `demo@sevenseasops.com`, whose org is `active` — verified 11/10.

**Order:** fix the trial days → reply to the 8 Oct message → then "Resubmit to
App Review". If the status flips to "In Review" on its own after the reply,
don't resubmit.

**What I could not verify:** Guideline 3.1.3(c) covers apps sold *only* to
organisations. Nothing in the product today stops a single-person operator from
buying a Starter plan on the web, and there are reports of reviewers refusing
the Enterprise Services exception on that basis. The reply does not claim
individual purchase is blocked — it describes who the customer is, which is
true. If they press that point it's a product decision, not a code one.

**Deliberately absent:** any mention of Apple's commission, Paddle's fees, or
why the web is cheaper for us. They asked who buys what and where. Volunteering
the economics invites an argument about whether we are avoiding In-App Purchase
instead of a reading of 3.1.3(c).
