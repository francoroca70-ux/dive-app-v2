-- Custom department checklists -- lets a department "head" build their own
-- checklist for their own crew (e.g. Head Steward for Stewards, or any peer
-- role like Bosun/Engineer/Deckhand for themselves where no head role exists
-- yet). Run this once in the Supabase SQL Editor.

create table if not exists custom_checklists (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  dept_key text not null,               -- which Department Checklists tab this shows under: captain / deck / instructor / stewards
  role_scope text not null,             -- the specific crew role this checklist is for, e.g. 'bosun', 'steward'
  cadence text not null check (cadence in ('morning','eod','monthly','yearly')),
  title text not null,
  items text[] not null default '{}',
  created_by uuid references staff(id),
  created_at timestamptz not null default now()
);

alter table custom_checklists enable row level security;

-- Everyone at the org can see every custom checklist (visibility into which
-- tab it appears under is already handled client-side the same way built-in
-- department tabs are filtered by role).
create policy "custom_checklists_select_same_org" on custom_checklists
for select using (
  org_id = (select org_id from staff where id = auth.uid())
);

-- Insert is allowed for: owner/manager (any role_scope), a staff member
-- creating a checklist for their OWN role, or a designated "head" role
-- creating one for the role they lead (head_steward -> steward, head_chef -> chef).
create policy "custom_checklists_insert_own_or_headed" on custom_checklists
for insert with check (
  org_id = (select org_id from staff where id = auth.uid())
  and (
    (select role from staff where id = auth.uid()) in ('owner','manager')
    or role_scope = (select role from staff where id = auth.uid())
    or ((select role from staff where id = auth.uid()) = 'head_steward' and role_scope = 'steward')
    or ((select role from staff where id = auth.uid()) = 'head_chef' and role_scope = 'chef')
  )
);

-- Only the creator or owner/manager can edit or delete a custom checklist.
create policy "custom_checklists_update_own_or_admin" on custom_checklists
for update using (
  org_id = (select org_id from staff where id = auth.uid())
  and (
    created_by = auth.uid()
    or (select role from staff where id = auth.uid()) in ('owner','manager')
  )
);

create policy "custom_checklists_delete_own_or_admin" on custom_checklists
for delete using (
  org_id = (select org_id from staff where id = auth.uid())
  and (
    created_by = auth.uid()
    or (select role from staff where id = auth.uid()) in ('owner','manager')
  )
);
