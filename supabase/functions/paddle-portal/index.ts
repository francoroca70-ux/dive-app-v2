import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Paddle billing phase 6: generates a one-time link into Paddle's hosted
// customer portal (update card, view invoices, cancel/change plan) for the
// caller's own org. Called from the "Manage billing" button in Settings.
//
// NOTE (30/09/2026): this file was recovered from the deployed function --
// version 8 was live in Supabase and had never been committed anywhere. It is
// byte-for-byte what is running; do not "tidy" it without redeploying.
//
// The POST check on the first line is what made "Manage billing" fail for the
// first real subscriber: the browser was calling invoke() without a body and
// the request arrived as something other than POST, so this returned 405
// before touching Paddle. Three of the early returns below (401, 403, 400)
// also answer without logging anything, which is why the Supabase function
// logs were empty while the edge logs showed the 405. If this function is
// ever edited, give those three a console.warn -- a silent 4xx costs hours.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PADDLE_API_KEY = Deno.env.get("PADDLE_API_KEY") ?? "";
// Swap to https://api.paddle.com via the PADDLE_API_BASE secret at go-live,
// same as PADDLE_ENV in index.html.
const PADDLE_API_BASE = Deno.env.get("PADDLE_API_BASE") || "https://sandbox-api.paddle.com";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return json({ error: "method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return json({ error: "missing auth" }, 401);
  }

  // User-scoped client -- confirms who's calling and respects RLS when
  // looking up their own staff row.
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) {
    return json({ error: "unauthorized" }, 401);
  }

  const { data: staffRow } = await userClient
    .from("staff")
    .select("org_id, role")
    .eq("id", user.id)
    .single();

  if (!staffRow || staffRow.role !== "owner") {
    return json({ error: "owner only" }, 403);
  }

  if (!PADDLE_API_KEY) {
    console.error("paddle-portal: PADDLE_API_KEY secret not set");
    return json({ error: "billing portal not configured yet" }, 500);
  }

  // Service-role client to read the org's Paddle customer id regardless of
  // organizations RLS policies.
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: org } = await adminClient
    .from("organizations")
    .select("paddle_customer_id")
    .eq("id", staffRow.org_id)
    .single();

  if (!org?.paddle_customer_id) {
    return json({ error: "no paddle customer on file" }, 400);
  }

  const paddleRes = await fetch(
    `${PADDLE_API_BASE}/customers/${org.paddle_customer_id}/portal-sessions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PADDLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    }
  );

  if (!paddleRes.ok) {
    const errText = await paddleRes.text();
    console.error("paddle-portal: Paddle API error", paddleRes.status, errText);
    return json({ error: "paddle api error" }, 502);
  }

  const paddleData = await paddleRes.json();
  const url = paddleData?.data?.urls?.general?.overview;
  if (!url) {
    console.error("paddle-portal: no portal url in response", JSON.stringify(paddleData));
    return json({ error: "no portal url returned" }, 502);
  }

  return json({ url });
});
