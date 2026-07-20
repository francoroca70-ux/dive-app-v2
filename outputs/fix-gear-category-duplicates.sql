-- Seven Seas: fix duplicated gear categories in Inventory
-- (Diving / Charter & Yacht / Surf got seeded 2-3x each due to a race
-- condition in the recent Inventory fix — this cleans that up.)
-- Run this once in Supabase → SQL Editor.

-- 1) For each duplicated category, keep the oldest copy. Merge any stock
--    counts recorded on the duplicate copies' items into the matching item
--    (same name) on the kept copy, then remove the duplicate items, sizes,
--    stock rows, and category rows.
do $$
declare
  keep_cat record;
  dup_cat record;
  dup_item record;
  keep_item_id uuid;
begin
  for keep_cat in
    select distinct on (org_id, key) id, org_id, key
    from gear_categories
    order by org_id, key, created_at asc
  loop
    for dup_cat in
      select id from gear_categories
      where org_id = keep_cat.org_id and key = keep_cat.key and id <> keep_cat.id
    loop
      for dup_item in
        select id, name from gear_items where category_id = dup_cat.id
      loop
        select id into keep_item_id from gear_items
        where category_id = keep_cat.id and name = dup_item.name
        limit 1;

        if keep_item_id is not null then
          update gear_stock gs
          set available_count = gs.available_count + ds.available_count,
              repair_count = gs.repair_count + ds.repair_count
          from gear_stock ds
          where ds.gear_item_id = dup_item.id
            and gs.gear_item_id = keep_item_id
            and gs.size_label = ds.size_label;

          insert into gear_stock (gear_item_id, size_label, location_id, available_count, repair_count)
          select keep_item_id, ds.size_label, ds.location_id, ds.available_count, ds.repair_count
          from gear_stock ds
          where ds.gear_item_id = dup_item.id
            and not exists (
              select 1 from gear_stock gs2
              where gs2.gear_item_id = keep_item_id
                and gs2.size_label = ds.size_label
                and gs2.location_id = ds.location_id
            );
        end if;

        delete from gear_stock where gear_item_id = dup_item.id;
        delete from gear_item_sizes where gear_item_id = dup_item.id;
      end loop;

      delete from gear_items where category_id = dup_cat.id;
      delete from gear_categories where id = dup_cat.id;
    end loop;
  end loop;
end $$;

-- 2) Prevent this from ever happening again (the app code now relies on this
--    constraint to safely skip re-seeding a category that already exists).
alter table gear_categories add constraint gear_categories_org_key_unique unique (org_id, key);
