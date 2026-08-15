// Supabase Edge Function: close-shop
// Powers the owner-only "Close This Shop's Account" flow in Settings (Danger
// Zone, below the plain "leave this shop" button). This is deliberately NOT
// a delete -- per Fran's call, closing a shop sets organizations.closed_at
// instead of destroying anything. Waivers exist specifically for legal/
// insurance protection, so permanently erasing a shop's whole history the
// moment its subscription ends would defeat the product's own purpose if a
// claim ever surfaces later. Blocking login is what actually matters here;
// data retention afterward is a separate, more careful decision than a
// single self-service button should make irreversibly.
//
// Requires organizations.closed_at (timestamptz, nullable) to exist -- run
// once in the Supabase SQL Editor:
//   alter table organizations add column if not exists closed_at timestamptz;
//
// Called from index.html via sb.functions.invoke('close-shop', {}) -- no
// body needed, the caller's identity comes from their own auth JWT.
// index.html's loadSettings() checks organizations.closed_at on every login,
// signup, and session restore, and signs out + blocks access if it's set.

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
    // client-supplied org id or role for an action this consequential.
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

    if (staffRow.role !== "owner") {
      return json({ error: "not_owner" }, 403);
    }

    const { error: updateErr } = await sb
      .from("organizations")
      .update({ closed_at: new Date().toISOString() })
      .eq("id", staffRow.org_id);

    if (updateErr) return json({ error: updateErr.message }, 500);

    return json({ success: true });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
