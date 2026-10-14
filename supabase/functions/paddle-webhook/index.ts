import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Paddle billing phase 5: receives subscription lifecycle webhooks and
// keeps organizations.subscription_status / plan_tier / paddle_* ids in
// sync. org_id travels here via the customData we attach at
// Paddle.Checkout.open() time in index.html, so we match payments back to
// the right org directly instead of looking one up by customer email.
//
// verify_jwt is deliberately false: Paddle can't send a Supabase JWT. The
// endpoint authenticates every request itself via the HMAC signature below,
// which is strictly stronger than a shared bearer token would be.

const PADDLE_WEBHOOK_SECRET = Deno.env.get("PADDLE_WEBHOOK_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Optional last-resort map, as JSON: {"pri_abc":"starter","pri_def":"growth"}.
// Only consulted when neither the price nor the product carries a plan_tier in
// its custom data. Empty by default and that is fine.
const PADDLE_PRICE_TIERS = Deno.env.get("PADDLE_PRICE_TIERS") ?? "";

// How old a signed timestamp may be before we refuse it. Paddle signs each
// delivery attempt (including its own retries) with a fresh ts, so this only
// ever rejects genuinely stale payloads -- i.e. replays. Without it, anyone
// who ever obtains one valid request body + signature can re-send it forever:
// replaying an old `subscription.activated` would flip a canceled org back to
// active, which is a free subscription. 5 minutes leaves room for clock skew.
const MAX_SIGNATURE_AGE_SECONDS = 300;

const VALID_TIERS = new Set(["starter", "growth", "pro", "enterprise"]);

async function verifySignature(
  rawBody: string,
  signatureHeader: string | null
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!signatureHeader) return { ok: false, reason: "missing signature header" };
  if (!PADDLE_WEBHOOK_SECRET) return { ok: false, reason: "PADDLE_WEBHOOK_SECRET not set" };

  const parts: Record<string, string> = {};
  for (const pair of signatureHeader.split(";")) {
    const [k, v] = pair.split("=");
    if (k && v) parts[k] = v;
  }
  const ts = parts["ts"];
  const h1 = parts["h1"];
  if (!ts || !h1) return { ok: false, reason: "malformed signature header" };

  const tsSeconds = Number(ts);
  if (!Number.isFinite(tsSeconds)) return { ok: false, reason: "non-numeric ts" };
  const ageSeconds = Math.abs(Date.now() / 1000 - tsSeconds);
  if (ageSeconds > MAX_SIGNATURE_AGE_SECONDS) {
    return { ok: false, reason: `stale signature (${Math.round(ageSeconds)}s old)` };
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(PADDLE_WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signed = await crypto.subtle.sign("HMAC", key, encoder.encode(`${ts}:${rawBody}`));
  const computedHex = Array.from(new Uint8Array(signed))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time compare so a wrong guess can't be narrowed down by timing.
  if (computedHex.length !== h1.length) return { ok: false, reason: "signature mismatch" };
  let mismatch = 0;
  for (let i = 0; i < computedHex.length; i++) {
    mismatch |= computedHex.charCodeAt(i) ^ h1.charCodeAt(i);
  }
  return mismatch === 0 ? { ok: true } : { ok: false, reason: "signature mismatch" };
}

// ─── Which plan was actually paid for ───
//
// This used to read data.custom_data.plan_tier. That object is built in the
// BROWSER, at Paddle.Checkout.open() time, so anyone with the console open
// could pay for Starter while sending plan_tier: 'pro' and walk away with a
// Pro org for the price of a Starter one.
//
// Everything consulted below is set in the Paddle dashboard and travels with
// the subscription. The client can't reach any of it:
//
//   1. items[].price.custom_data.plan_tier    ← preferred
//   2. items[].product.custom_data.plan_tier  ← same idea, one level up
//   3. PADDLE_PRICE_TIERS, a price-id → tier map in the function's secrets
//
// If none of those yields a tier the answer is "we don't know", NOT "believe
// the browser". An unknown tier leaves plan_tier untouched: the subscription
// status still updates, so a real customer is never locked out by this, and
// nobody gets upgraded by asking nicely.
function resolvePlanTier(data: any): { tier: string | null; source: string } {
  const items = Array.isArray(data?.items) ? data.items : [];

  for (const item of items) {
    const fromPrice = item?.price?.custom_data?.plan_tier;
    if (typeof fromPrice === "string" && VALID_TIERS.has(fromPrice)) {
      return { tier: fromPrice, source: "price.custom_data" };
    }
  }
  for (const item of items) {
    const fromProduct = item?.product?.custom_data?.plan_tier;
    if (typeof fromProduct === "string" && VALID_TIERS.has(fromProduct)) {
      return { tier: fromProduct, source: "product.custom_data" };
    }
  }
  if (PADDLE_PRICE_TIERS) {
    try {
      const map = JSON.parse(PADDLE_PRICE_TIERS) as Record<string, string>;
      for (const item of items) {
        const id = item?.price?.id;
        const mapped = id ? map[id] : null;
        if (typeof mapped === "string" && VALID_TIERS.has(mapped)) {
          return { tier: mapped, source: "PADDLE_PRICE_TIERS" };
        }
      }
    } catch {
      console.error("paddle-webhook: PADDLE_PRICE_TIERS is not valid JSON, ignoring it");
    }
  }
  return { tier: null, source: "none" };
}

const STATUS_MAP: Record<string, string> = {
  trialing: "trialing",
  active: "active",
  past_due: "past_due",
  paused: "paused",
  canceled: "canceled",
};

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const rawBody = await req.text();
  const signatureHeader = req.headers.get("paddle-signature");

  const verdict = await verifySignature(rawBody, signatureHeader);
  if (!verdict.ok) {
    console.error(`paddle-webhook: rejected -- ${verdict.reason}`);
    return new Response("Invalid signature", { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const eventType = String((payload as any)?.event_type ?? "");
  const data = (payload as any)?.data ?? {};

  if (eventType.startsWith("subscription.")) {
    // org_id still comes from the checkout's custom_data, and that is fine:
    // it only says WHICH org to credit, and crediting the wrong org would
    // mean paying for someone else's shop. There is no incentive to forge it,
    // and no way to escalate with it. plan_tier was different -- forging that
    // one was free money, which is why it now comes from Paddle instead.
    const orgId = data?.custom_data?.org_id;
    const claimedTier = data?.custom_data?.plan_tier;
    const subscriptionId = data?.id;
    const customerId = data?.customer_id;
    const rawStatus = data?.status;
    const status = STATUS_MAP[rawStatus] ?? rawStatus ?? null;

    if (!orgId) {
      console.error(`paddle-webhook: ${eventType} missing custom_data.org_id (sub ${subscriptionId})`);
      return new Response("ok (no org_id, ignored)", { status: 200 });
    }

    const { tier, source } = resolvePlanTier(data);

    // A claim that disagrees with what Paddle says is either a stale checkout
    // or someone trying it on. Either way it is worth a line in the log: it
    // is the only place the attempt would ever show up.
    if (claimedTier && tier && claimedTier !== tier) {
      console.error(
        `paddle-webhook: SECURITY -- browser claimed plan_tier '${claimedTier}' but Paddle says ` +
        `'${tier}' (via ${source}) for org ${orgId}, sub ${subscriptionId}. Using Paddle's.`
      );
    }
    if (!tier) {
      console.error(
        `paddle-webhook: no plan_tier from Paddle for sub ${subscriptionId} (org ${orgId}). ` +
        `Set plan_tier in each price's or product's Custom Data, or the PADDLE_PRICE_TIERS secret. ` +
        `Leaving plan_tier unchanged -- the browser's claim of '${claimedTier ?? "none"}' is NOT trusted.`
      );
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const update: Record<string, unknown> = {
      paddle_subscription_id: subscriptionId,
      subscription_status: status,
    };
    if (customerId) update.paddle_customer_id = customerId;
    if (tier) update.plan_tier = tier;

    // El cambio AGENDADO, que hasta el 14/10 se tiraba entero.
    //
    // Cancelar «al final del período» en Paddle NO cambia el estado: la
    // suscripción queda `active` hasta la fecha de factura. Así que un centro
    // que cancela con 20 días por delante veía la app exactamente igual que
    // antes, sin un «tu suscripción termina el 30 de octubre» en ningún lado --
    // muda justo en el momento en que el cliente quiere confirmación de que su
    // baja se registró.
    //
    // DOS cosas que hay que hacer bien o esto miente:
    //
    // 1 · `scheduled_change` llega como objeto O COMO NULL. Null es el caso de
    //     «se dio de baja el cambio agendado» (en Paddle el único valor que se
    //     le puede poner es null, justamente para quitarlo). Así que esto
    //     LIMPIA además de setear: tratarlo como «si viene, guardo» dejaría a
    //     un centro que canceló y se arrepintió viendo para siempre un cartel
    //     de que su suscripción termina.
    //
    // 2 · Paddle NO garantiza el orden de entrega de los webhooks, y lo dice en
    //     su documentación. Sin mirar `occurred_at`, un `subscription.updated`
    //     viejo que llega tarde resucitaría un cambio agendado ya quitado. Por
    //     eso se guarda el `occurred_at` aplicado y un evento más viejo no pisa
    //     estas columnas.
    const occurredAt = (payload as any)?.occurred_at ?? null;
    const scheduled = data?.scheduled_change ?? null;
    let aplicarCambioAgendado = true;

    if (occurredAt) {
      // Se reusa el `supabase` de arriba. La primera versión creaba un SEGUNDO
      // cliente acá, con uno ya declarado doce líneas antes -- sin motivo, y en
      // el camino del cobro.
      //
      // Y si esta lectura falla, `previo` queda undefined y el cambio **se
      // aplica**. Es deliberado: no poder leer el timestamp anterior exige
      // elegir qué se arriesga, y perder en silencio un cambio legítimo cada vez
      // que falle una lectura es peor que el caso rarísimo de que una lectura
      // falle Y además el evento venga fuera de orden.
      const { data: actual, error: errPrevio } = await supabase
        .from("organizations")
        .select("subscription_updated_at")
        .eq("id", orgId)
        .maybeSingle();
      if (errPrevio) {
        console.error(
          `paddle-webhook: no se pudo leer subscription_updated_at de ${orgId} ` +
          `(${errPrevio.message}); se aplica el cambio agendado sin guardia de orden`
        );
      }
      const previo = actual?.subscription_updated_at;
      if (previo && new Date(occurredAt) < new Date(previo)) {
        aplicarCambioAgendado = false;
        console.log(
          `paddle-webhook: evento fuera de orden para org ${orgId} ` +
          `(occurred_at ${occurredAt} < ${previo}); no se toca el cambio agendado`
        );
      }
    }

    if (aplicarCambioAgendado) {
      update.scheduled_change_action = scheduled?.action ?? null;
      update.scheduled_change_at = scheduled?.effective_at ?? null;
      if (occurredAt) update.subscription_updated_at = occurredAt;
    }

    const { error } = await supabase.from("organizations").update(update).eq("id", orgId);

    if (error) {
      console.error("paddle-webhook: db update failed", error.message);
      return new Response("db error", { status: 500 });
    }

    console.log(
      `paddle-webhook: org ${orgId} -> ${status} (${tier ? `${tier} via ${source}` : "tier unchanged"})` +
      (aplicarCambioAgendado
        ? (scheduled
            ? ` | agendado: ${scheduled.action} el ${scheduled.effective_at}`
            : " | sin cambio agendado")
        : " | cambio agendado sin tocar (evento viejo)")
    );
  } else {
    console.log(`paddle-webhook: ignoring event ${eventType}`);
  }

  return new Response("ok", { status: 200 });
});
