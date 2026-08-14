// Supabase Edge Function: leave-org
// Powers the self-service "Delete my account" button in Settings (Account
// card, bottom of the page). Runs on the service role key rather than a
// direct client-side sb.from('staff').delete(...) call, for two reasons:
//   1. Regular staff (not owner/manager) likely don't have an RLS DELETE
//      policy on their own `staff` row today -- the existing admin-side
//      removeStaff() in index.html only works because it's gated to
//      owner/manager in the UI and (presumably) in RLS. A normal captain/
//      instructor self-removing needs a path that isn't blocked by that.
//   2. The "can't leave if you're the last owner" check has to be done
//      authoritatively server-side, not trusted from the client.
//
// This deliberately mirrors removeStaff()'s actual behavior (delete
// staff_locations then delete the staff row) -- NOT a soft-delete -- because
// that's the exact same operation Fran's existing "remove crew" admin
// button already performs today, and historical tables (checklist_completions,
// waivers, trip_groups/participants, cash_ups, etc.) are NOT expected to
// cascade-delete when a staff row is removed -- if they did, the existing
// removeStaff() flow would already be destroying legal/audit history every
// time an owner removes someone, which is not the case.
//
// Called from index.html via sb.functions.invoke('leave-org', {}) -- no body
// needed, the caller's identity comes from their own auth JWT (forwarded
// automatically by supabase-js), verified server-side below rather than
// trusted from a client-supplied id.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify the caller's own identity from their JWT -- never trust a
    // client-supplied user id for a destructive self-service action.
    const authHeader = req.headers.get("Authorization") || "";
    const sbAsCaller = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await sbAsCaller.auth.getUser();
    if (userErr || !userData?.user) {
      return json({ error: "Not authenticated" }, 401);
    }
    const userId = userData.user.id;

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: staffRow, error: staffErr } = await sb
      .from("staff")
      .select("id, org_id, role")
      .eq("id", userId)
      .maybeSingle();

    if (staffErr) return json({ error: staffErr.message }, 500);
    if (!staffRow) return json({ error: "not_staff" }, 404);

    // Block the last owner of an org from removing themselves -- that would
    // leave the org with nobody able to manage it.
    if (staffRow.role === "owner") {
      const { count, error: countErr } = await sb
        .from("staff")
        .select("id", { count: "exact", head: true })
        .eq("org_id", staffRow.org_id)
        .eq("role", "owner")
        .neq("id", userId);
      if (countErr) return json({ error: countErr.message }, 500);
      if (!count) {
        return json({ error: "last_owner" }, 400);
      }
    }

    const { error: locErr } = await sb.from("staff_locations").delete().eq("staff_id", userId);
    if (locErr) return json({ error: locErr.message }, 500);

    const { error: delErr } = await sb.from("staff").delete().eq("id", userId);
    if (delErr) return json({ error: delErr.message }, 500);

    return json({ success: true });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
