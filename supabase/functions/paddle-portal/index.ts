import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Paddle billing phase 6: generates a one-time link into Paddle's hosted
// customer portal (update card, view invoices, cancel/change plan) for the
// caller's own org. Called from the "Manage billing" button in Settings.
//
// ─── Why the CORS block below is not boilerplate ───
//
// This function had no CORS handling and rejected anything that wasn't POST.
// The browser calls it cross-origin with an Authorization header, which makes
// it a *preflighted* request: Chrome sends OPTIONS first and only sends the
// POST if that answer says it may. OPTIONS hit `req.method !== "POST"` and got
// a bare 405, so the real POST was never sent at all.
//
// From the outside that looked like the button doing nothing. The Supabase
// *function* logs were empty -- an early return that doesn't log leaves no
// trace there -- while the *edge* logs showed the truth, but only once the
// request.method column was actually read:
//
//     OPTIONS  405  /functions/v1/paddle-portal
//
// So: answer OPTIONS before any other check, and put the CORS headers on every
// response, including the failures. A 403 without CORS headers reaches the
// browser as an opaque network error, which is how a clear "owner only" turns
// into "something went wrong".
//
// The other early returns now log too. A silent 4xx in a function that "does
// nothing" costs hours, and that is not a hypothetical here.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PADDLE_API_KEY = Deno.env.get("PADDLE_API_KEY") ?? "";
// Swap to https://api.paddle.com via the PADDLE_API_BASE secret at go-live,
// same as PADDLE_ENV in index.html.
const PADDLE_API_BASE = Deno.env.get("PADDLE_API_BASE") || "https://sandbox-api.paddle.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  // El preflight va primero: antes de esto, la petición real nunca se enviaba.
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    console.warn("paddle-portal: método no permitido:", req.method);
    return json({ error: "method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    console.warn("paddle-portal: sin cabecera Authorization");
    return json({ error: "missing auth" }, 401);
  }

  // User-scoped client -- confirms who's calling and respects RLS when
  // looking up their own staff row.
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) {
    console.warn("paddle-portal: token inválido o expirado");
    return json({ error: "unauthorized" }, 401);
  }

  const { data: staffRow } = await userClient
    .from("staff")
    .select("org_id, role")
    .eq("id", user.id)
    .single();

  if (!staffRow || staffRow.role !== "owner") {
    console.warn(`paddle-portal: no es dueño (user=${user.id}, role=${staffRow?.role ?? "sin fila en staff"})`);
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
    console.warn(`paddle-portal: la org ${staffRow.org_id} no tiene paddle_customer_id`);
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
