# Reply to App Review — Guideline 2.1(b), Information Needed

**Submission ID:** 84a8c50c-621a-4b13-86b0-7edafae99a9c
**Version:** 1.0 (136001)
**Prepared:** 11 October 2026

Paste the section below into the App Store Connect message thread. Everything in
it is true of build **136001 plus the change made on 11/10** (`sw v48`,
`build 2026-10-11f`) — so submit that build, or the answer to question 4 is not
accurate yet.

---

## PASTE FROM HERE

Thank you for the questions. Seven Seas Ops is a business-to-business
operations tool for dive centres and charter operations. It is not a consumer
app, and it contains no purchasable content. Below are answers to each of your
five questions.

**1. Who are the users that will use the paid content, subscriptions, features,
and services in the app?**

The users are the employees of a dive centre or charter operation that
subscribes to Seven Seas Ops as a business.

The subscription belongs to the business, not to an individual. One business
account typically covers an owner, a manager, boat captains, dive instructors,
deckhands, stewards and front-desk staff — commonly six to twelve people at one
operation. Each of them signs in with their own account, which the business
creates for them by invitation. They use the app to run the operation's daily
work: pre-dive and boat-loading checklists, equipment inspection records,
digital liability waivers, dive logs, trip scheduling and bookings.

No individual consumer buys anything, and there is nothing in the app that an
individual can buy. A member of staff cannot purchase, upgrade, or change
anything about the business's subscription from any platform, including this app.

**2. Where can users purchase the content, subscriptions, features, and
services that can be accessed in the app?**

The business subscribes on our website, sevenseasops.com, in a web browser,
before and independently of anyone installing the app. Payment is processed by
Paddle.com Market Ltd., which acts as the merchant of record.

This is the only place a subscription can be bought. It is not sold through the
app on any platform, it is not sold in the Google Play version either, and there
is no reseller or other channel.

**3. What specific types of previously purchased content, subscriptions,
features, and services can a user access in the app?**

There is no content library and nothing is sold item by item. What the
business's subscription determines is capacity: how many boats and locations the
operation may register, which corresponds to the size of the business. The
functional features of the app are the same at every tier.

A member of staff signing in on iOS sees their own operation's data — its boats,
its trips, its checklists, its records — created by their colleagues on whatever
device each of them uses. The app is one of several ways into the same business
account; the others are a web browser and Android.

**4. What paid content, subscriptions, or features are unlocked within the app
that do not use In-App Purchase?**

Nothing is unlocked within the app. The app contains no purchase functionality
at all: no in-app purchase, no third-party payment flow, no checkout, no prices,
no plan or pricing screen, no buy button, and no link or button that leads to a
purchase. Signing in to an account whose business already subscribes gives
access to that business's own operational records, which the business's own
employees created.

To be fully transparent about one point, and about a change we have just made:

In the build you reviewed, if a business's free trial had lapsed or its
subscription had been cancelled, the app displayed a screen listing our three
subscription tiers with their prices. That screen was intended for the web app
and should never have been reachable inside the iOS app. We consider that our
error. As of build `2026-10-11f`, submitted with this reply, that screen in the
iOS and Android apps shows no plans, no prices and no purchase controls — only a
plain statement that the business's subscription is not currently active and
that the operation's administrator manages it on our website. The billing
section has likewise been removed from the app entirely on iOS and Android, and
the in-app notices about a trial ending or a plan's limits no longer offer any
link to choose or change a plan — they state the situation and who resolves it.
We have added automated tests that fail the build if any price or purchase
control can appear in the app again.

We believe this falls under Guideline 3.1.3(c), Enterprise Services: Seven Seas
Ops is sold by us directly to organisations — dive centres and charter
operations — for use by their employees, and the app lets those employees access
what their organisation has already subscribed to. We are glad to adjust
anything that does not meet your expectations here.

**5. How do users obtain an account? Do users have to pay a fee to create an
account?**

No fee is charged to create an account, on any platform. There are two routes:

- A business owner creates the operation's account themselves, free of charge,
  and receives a 15-day free trial granted by our application. No payment
  method is required to start it.
- Everyone else is invited by their own operation. The owner or manager enters
  their email address, they receive an invitation, and they set a password. They
  never see a payment step at any point, because the subscription is the
  business's.

Accounts can be created in the app as well as on the web, and in both cases it
is free.

### For your testing

We have an account with an active subscription set up for review. The
credentials are in the App Review Information section of this submission. Please
use that account: an account whose trial has lapsed is intentionally blocked
from the operational screens, in the app and on the web alike, which would stop
you from seeing the app's actual functionality.

Thank you for your time. Please tell us if any part of this needs more detail.

## PASTE TO HERE

---

## Notes for Fran — not for Apple

**Before you send this, two things have to be true, or the reply is not:**

1. **Push and submit build `2026-10-11f`.** Question 4 says the screen has been
   fixed. If you reply against 136001 and they re-test 136001, they find the
   price screen still there and the answer reads as false — which is far worse
   than the original question.
2. **Check the App Review Information section has demo credentials for an
   account with an active plan.** The reply points them there. If it is empty,
   fill it in before sending. And confirm that account's
   `subscription_status = 'active'`, because a lapsed one hits the lock screen
   and they cannot review anything.

**What I could not verify, and you should know:**

Guideline 3.1.3(c) covers apps sold *only* to organisations. Nothing in the
product today physically stops a single-person operator from buying a Starter
plan on the web, and there are reports of reviewers refusing the Enterprise
Services exception on exactly that basis. The reply does not claim individual
purchase is blocked — it describes who the customer is, which is true. If they
push back on this specific point, the answer is a product decision, not a code
one, and worth a conversation before replying.

**What is NOT in this reply, deliberately:** any mention of Apple's commission,
of Paddle's fees, or of why the web is cheaper for us. The question they asked is
who buys what and where. Volunteering the economics invites an argument about
whether we are avoiding In-App Purchase rather than a reading of 3.1.3(c).
