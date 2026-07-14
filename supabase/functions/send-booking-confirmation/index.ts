// Supabase Edge Function: send-booking-confirmation
// Sends a booking confirmation email via Resend (https://resend.com) when a guest's
// contact email is saved on a trip_groups record. Called from index.html via
// sb.functions.invoke('send-booking-confirmation', { body: {...} }).
//
// Required secret (set in Supabase Dashboard -> Edge Functions -> Secrets):
//   RESEND_API_KEY        - your Resend API key
// Optional secret:
//   RESEND_FROM_EMAIL     - defaults to onboarding@resend.dev (Resend's test sender,
//                            which only delivers to your own verified Resend account
//                            email). Once you verify your own domain with Resend,
//                            set this to something like bookings@yourshop.com so
//                            real guests receive it.

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY secret is not set" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const {
      to, guestName, tripType, tripDate, tripTime, boatName,
      pricePerPerson, currency, orgName, orgEmail,
    } = body || {};

    if (!to) {
      return new Response(JSON.stringify({ error: "Missing recipient email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dateLabel = tripDate
      ? new Date(tripDate + "T12:00:00").toLocaleDateString("en-US", {
          weekday: "long", year: "numeric", month: "long", day: "numeric",
        })
      : "";
    const priceLine = pricePerPerson
      ? `<p><strong>Price per person:</strong> ${currency || "USD"} ${Number(pricePerPerson).toFixed(2)}</p>`
      : "";

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;">
        <h2 style="color:#1a6b8a;">Booking confirmed${orgName ? " — " + orgName : ""}</h2>
        <p>Hi ${guestName || "there"},</p>
        <p>Your booking is confirmed. Here are the details:</p>
        <div style="background:#f0f7fa;border-radius:8px;padding:16px;margin:16px 0;">
          <p><strong>Trip:</strong> ${tripType || "Trip"}</p>
          <p><strong>Date:</strong> ${dateLabel}</p>
          ${tripTime ? `<p><strong>Departure:</strong> ${String(tripTime).slice(0, 5)}</p>` : ""}
          ${boatName ? `<p><strong>Boat:</strong> ${boatName}</p>` : ""}
          ${priceLine}
        </div>
        <p>If anything needs to change, just reply to this email${orgEmail ? " or reach us at " + orgEmail : ""}.</p>
        <p style="color:#888;font-size:0.85em;margin-top:24px;">See you soon!</p>
      </div>
    `;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${orgName || "Bookings"} <${FROM_EMAIL}>`,
        to: [to],
        reply_to: orgEmail || undefined,
        subject: `Booking confirmed — ${tripType || "your trip"} on ${dateLabel}`,
        html,
      }),
    });

    const resendData = await resendRes.json();
    if (!resendRes.ok) {
      return new Response(JSON.stringify({ error: resendData }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, id: resendData.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
