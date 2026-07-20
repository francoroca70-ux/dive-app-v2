# Seven Seas — Lawyer Consultation Prep

*Questions to raise, ordered roughly by how foundational/complex they are — plus a checklist of documents to come out of this with. Prepared for Fran Roca, July 2026.*

This isn't legal advice — it's a working list of what to bring up with your lawyer, built from everything Seven Seas does today (bookings, digital waivers, crew management, gear inventory) plus what's coming (subscription billing with automatic card debit, global customers). Sections are ordered so the foundational questions (entity structure) come first, since they affect how everything after them gets answered.

## 1. Business Entity & Structure

*Foundational — this affects how you register for tax, what liability protection you actually have, and how you can legally accept payments internationally. Worth settling before the other sections.*

1. I'm based in Argentina but selling software to customers who could be anywhere (US, EU, Asia-Pacific dive shops). Does it make more sense to incorporate in Argentina (e.g. a S.A.S.), set up a foreign entity (e.g. a US LLC), or do I need both?
2. Does using Stripe (or any payment processor) to charge international customers require me to be incorporated in a specific country, or to hold a bank account in a specific currency/region?
3. What are the tax residency and reporting implications of running this business while I'm still working toward Spanish citizenship and living semi-nomadically?
4. Does one entity cover sales to customers in every country, or do certain countries require local registration once I have customers there?
5. Should the business (once formed) own the trademark, code copyright, and Seven Seas name — or should I own the IP personally and license it to the business? Which protects me better if something goes wrong?
6. Given I'm pre-revenue/early-revenue, is there a minimum-viable entity structure to start with now, with a clear trigger point (e.g. revenue threshold) for when to upgrade to something more robust?

## 2. Liability, Waivers & Product Risk

*The highest-stakes section — Seven Seas is used to record real dive safety checklists and liability waivers. If something goes wrong on an actual dive, this is where exposure lives.*

1. The app is a record-keeping tool for pre-dive checklists, equipment inspections, and liability waivers — it doesn't certify divers or make safety judgment calls. What disclaimer / limitation-of-liability language makes that boundary clear and defensible in the Terms of Service?
2. Argentina recognizes tiered electronic signatures under Law 25,506 — simple electronic signatures are valid but carry less evidentiary weight than a certified digital signature. Does Seven Seas' current waiver signing (typed/drawn signature plus timestamp) meet the bar to hold up in court if a shop is ever sued, in Argentina and in the other countries where shops might operate?
3. If a diver is injured or killed and the shop used Seven Seas to record their waiver or pre-dive checklist, could Seven Seas realistically be named in the resulting lawsuit? What contract language or structure actually protects against that?
4. If a shop skips a required checklist step, or a crew member misuses the app, and something goes wrong — does that shift liability entirely to the shop, or is there a scenario where Seven Seas is still exposed?
5. Minors' data (date of birth, guardian signature) is collected for waiver purposes — does that trigger any extra consent or liability requirements beyond what's already built?
6. What's the right "as-is, no warranty" language for a tool where a bug, sync delay, or downtime could theoretically affect a real safety-critical workflow (e.g. offline mode syncing a waiver after the dive already happened)?
7. Established waiver tools (Smartwaiver, WaiverForever) handle liability by (a) providing the e-signature/record-keeping tool without guaranteeing any specific waiver's enforceability in a given jurisdiction, and (b) putting responsibility for the waiver's actual legal content and local-law compliance on the operator (the dive shop), not the software provider. Can Seven Seas' Terms of Service be structured the same way, and is that actually the right model given the product also touches dive-safety record-keeping specifically, not just generic liability waivers?
8. We're planning to let guests sign waivers remotely via a link in the booking confirmation email, before they ever arrive at the shop — not only in person with a staff member present as a witness. Does removing that in-person staff witness change the evidentiary weight or enforceability of the signature, in Argentina or elsewhere?

## 3. Subscription Billing, Auto-Renewal & Payment Compliance

*Concrete and timely — I'm about to build automatic recurring billing (Stripe), with a free trial that auto-converts, a failed-payment email reminder, and a 3-day grace period before cutting access.*

1. What disclosures are legally required when a customer's card is charged automatically on a recurring basis, especially when a free trial auto-converts to paid? Several jurisdictions (US FTC "click to cancel" rules, EU consumer rights rules) have specific requirements here.
2. Is a 3-day grace period after a failed payment — email reminder on day 1, access cut on day 4 if still unresolved — legally sufficient, or do some jurisdictions require longer notice before suspending a paying customer's access to their own business data?
3. What does the refund/cancellation policy need to say, and does it need to differ by region (EU consumers generally have stronger statutory refund rights than US ones — though this may be lighter-touch since my customers are businesses, not individual consumers)?
4. If a subscription is cancelled for non-payment, am I required to still let the shop export their data (guest lists, waivers, dive logs) before it's deleted, or can access simply be cut off?
5. Does this need a standalone Subscription/Billing Agreement, or can it live as a section inside the main Terms of Service?
6. If I use Stripe directly (not a merchant-of-record platform), what billing-dispute or chargeback liability do I still carry as the seller of record?

## 4. Data Privacy, Security & Cross-Border Data

*Genuinely complex given the spread of customers — the app collects guest names, phone numbers, dates of birth, certification levels, and dive medical questionnaire-style answers, hosted on infrastructure (Supabase, Resend) that may sit in a different country than either me or my customers.*

1. Some data collected (dive medical/fitness questionnaire answers) could count as sensitive/special-category data under GDPR. What extra protections, consent language, or handling rules does that trigger?
2. My infrastructure providers are Supabase (database) and Resend (email) — do I need a formal Data Processing Agreement naming them as sub-processors, and is a DPA something my (small business) customers would realistically ask for, or is that more of an enterprise-scale concern?
3. Where is customer data physically hosted, and does that matter for EU customers under GDPR data-residency expectations, or for customers in other regions with their own data localization rules?
4. My direct contract is with the dive shop, not the diver — what rights does the end-guest (the diver whose data is in the system) have, and who's responsible for honoring them, me or the shop?
5. Does the marketing/landing page need a separate Cookie Policy from the app's own Privacy Policy?
6. What breach-notification obligations would apply if customer data were ever exposed, and do they differ by which countries my customers are in?

## 5. Intellectual Property & Branding

*Already partly underway — trademark filing and DNDA copyright registration are on my list — but worth confirming scope with you directly.*

1. Should the "Seven Seas" trademark be filed in Argentina only, or does it make sense to file internationally (e.g. via the Madrid Protocol) given customers could be anywhere?
2. What does DNDA software copyright registration actually protect, and is it sufficient on its own — or should I also be thinking about trade secret protection for things like the pricing/booking logic?
3. If Seven Seas uses open-source libraries, are there any license-compliance or disclosure obligations I need to be aware of?
4. Who owns content a shop uploads into the platform (their logo, photos, custom checklist wording) — the shop, or Seven Seas, once it's in the system?

## 6. Insurance & Risk Transfer

*The final layer — once the entity, liability language, and IP are sorted, does the actual risk need to be insured against?*

1. Given the product touches real dive-safety record-keeping, should I be carrying professional liability / errors & omissions insurance, and separately cyber liability insurance, before this is fully live to paying customers?
2. Is there a minimum-viable insurance setup appropriate for a pre-revenue/early-revenue solo founder, with a clear point (revenue, customer count, or geography) at which it's worth upgrading coverage?

## 7. Flagged for Later — 3D Dive Site Maps (not part of this consultation)

*Not needed for this meeting — flagging now so it's on the radar for a follow-up consultation once this feature is actually built, not before.*

Seven Seas may eventually let dive shops submit raw video/photo footage of a dive site, which gets processed into a downloadable 3D model available to other shops/users. When that's closer to being built, worth revisiting:
1. What license Seven Seas needs from a contributing shop to host, process, and redistribute their footage/model to other users.
2. Whether shipwrecks carry special legal protections in some jurisdictions (war graves, protected archaeological/heritage sites) that would affect filming or publicly displaying a 3D reconstruction of them.
3. Any additional cross-border data/hosting considerations for large media files, beyond what applies to the text/photo data Seven Seas handles today.

## Documents to Come Out of This With

The checklist of paperwork this consultation should produce or greenlight — roughly in the order they'd need to exist before shops start paying.

1. **Terms of Service** — the legal foundation — acceptable use, subscription/billing terms, limitation of liability, termination for non-payment, dispute resolution/governing law
2. **Privacy Policy** — what data is collected, why, who it's shared with (sub-processors), how long it's kept, and how someone can request their data
3. **Waiver/Liability Disclaimer language** — specific wording clarifying Seven Seas is a record-keeping tool, not a certifying or safety authority — likely folds into the ToS but worth drafting deliberately
4. **Subscription & Billing Terms** — auto-renewal disclosure, trial-to-paid conversion, refund/cancellation policy, grace period before access is cut — may be a section of the ToS or standalone
5. **Cookie Policy** — for the landing/marketing site
6. **Data Processing Agreement (DPA) template** — to have ready if/when a shop customer asks for one
7. **Trademark filing** — "Seven Seas" name + logo — already on my task list, scope (Argentina-only vs. international) to be confirmed here
8. **DNDA software copyright registration** — already on my task list — confirm this covers what we think it covers

---

*Not legal advice — a prep list to make the most of paid time with a lawyer. Built from the current state of the Seven Seas app as of July 2026.*
