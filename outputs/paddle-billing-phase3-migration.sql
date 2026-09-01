-- Seven Seas — Paddle Billing, Phase 3: trial-expiry tracking
-- Run this once in Supabase Dashboard -> SQL Editor -> New query -> Run.
--
-- Adds the columns needed for the free-trial banner (live now) plus the
-- columns the later Paddle webhook (phase 5) will need, so this doesn't
-- have to be a second disruptive migration later.

alter table organizations
  add column if not exists trial_ends_at timestamptz,
  add column if not exists subscription_status text not null default 'active',
  add column if not exists plan_tier text,
  add column if not exists paddle_customer_id text;

-- Grandfather in every org that existed BEFORE this migration as 'active'
-- with no trial limit -- these shops are already up and running, it would
-- be wrong to suddenly start a 14-day countdown on them retroactively.
-- New orgs created from now on explicitly set subscription_status:'trial'
-- and trial_ends_at at signup time in the app itself (see btn-save-org
-- handler in index.html), overriding the 'active' default above.
update organizations
set subscription_status = 'active'
where trial_ends_at is null;
