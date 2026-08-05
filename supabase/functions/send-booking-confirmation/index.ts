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

// Public base URL the logo images are served from (the live Render deployment --
// email clients fetch images over plain HTTP, so this can't point at a local path).
const APP_ORIGIN = "https://dive-app-v2.onrender.com";

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
      pricePerPerson, currency, orgName, orgEmail, waiverLink,
    } = body || {};

    if (!to) {
      return new Response(JSON.stringify({ error: "Missing recipient email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orgLabel = orgName || "Seven Seas";
    const dateLabel = tripDate
      ? new Date(tripDate + "T12:00:00").toLocaleDateString("en-US", {
          weekday: "long", year: "numeric", month: "long", day: "numeric",
        })
      : "";

    function detailRow(label: string, value: string) {
      return `
        <tr>
          <td style="padding:6px 0;font-size:13px;color:#667085;width:120px;vertical-align:top;">${label}</td>
          <td style="padding:6px 0;font-size:14px;color:#0a1628;font-weight:600;">${value}</td>
        </tr>
      `;
    }

    const detailRows = [
      detailRow("Trip", tripType || "Trip"),
      dateLabel ? detailRow("Date", dateLabel) : "",
      tripTime ? detailRow("Departure", String(tripTime).slice(0, 5)) : "",
      boatName ? detailRow("Boat", boatName) : "",
      pricePerPerson ? detailRow("Price per person", `${currency || "USD"} ${Number(pricePerPerson).toFixed(2)}`) : "",
    ].join("");

    // Waiver CTA -- only present once trip_groups has a signing link generated
    // for this booking (see getOrCreateWaiverSigningLink in index.html). Lets
    // every guest in the group sign before they arrive, same as Smartwaiver's
    // event-link / WaiverForever's group-request flow.
    const waiverSection = waiverLink
      ? `
        <tr>
          <td style="padding:0 32px 8px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff8e6;border:1px solid #f0d78c;border-radius:10px;">
              <tr>
                <td style="padding:18px 20px;">
                  <p style="margin:0 0 12px;font-size:14px;line-height:1.5;color:#5a4c1f;"><strong>One more thing</strong> — please sign your waiver(s) before you arrive so check-in is quick. If your booking has more than one guest, everyone can sign from the same link.</p>
                  <a href="${waiverLink}" style="background:#1a6b8a;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;display:inline-block;">Sign waiver(s)</a>
                  <p style="margin:12px 0 0;font-size:11px;color:#8a7a3d;word-break:break-all;">If the button doesn't work, copy and paste this link into your browser:<br>${waiverLink}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      `
      : "";

    const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f0f8ff;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f8ff;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
          <tr>
            <td align="center" style="background:#0a1628;padding:32px 24px;">
              <img src="${APP_ORIGIN}/assets/icons/icon-192.png" width="52" height="52" alt="Seven Seas" style="display:block;margin:0 auto 14px;border-radius:12px;">
              <img src="${APP_ORIGIN}/assets/logo-wordmark-white.png" width="150" alt="Seven Seas" style="display:block;margin:0 auto;">
            </td>
          </tr>
          <tr>
            <td style="padding:36px 32px 8px;">
              <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#4fc3f7;">Booking Confirmed</p>
              <h1 style="margin:0 0 20px;font-size:22px;line-height:1.3;color:#0a1628;">Your trip with ${orgLabel} is booked!</h1>
              <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#1a2a3a;">Hi ${guestName || "there"},</p>
              <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#1a2a3a;">Thanks for booking with ${orgLabel}! Here's a summary of your upcoming trip, plus what to do before you arrive.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f8ff;border-radius:10px;">
                <tr>
                  <td style="padding:18px 22px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      ${detailRows}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ${waiverSection}
          <tr>
            <td style="padding:20px 32px 8px;">
              <p style="margin:0 0 12px;font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#1a6b8a;">Before you arrive</p>
              <p style="margin:0 0 8px;font-size:14px;line-height:1.5;color:#1a2a3a;">• Sign your waiver(s) ahead of time so check-in is quick.</p>
              <p style="margin:0 0 8px;font-size:14px;line-height:1.5;color:#1a2a3a;">• Please arrive a few minutes before departure.</p>
              <p style="margin:0;font-size:14px;line-height:1.5;color:#1a2a3a;">• Need to change anything? Just reply to this email${orgEmail ? ` or reach us at ${orgEmail}` : ""}.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 32px;">
              <p style="margin:0;font-size:14px;color:#1a2a3a;">See you soon — safe travels!</p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 32px;border-top:1px solid #eef2f6;">
              <p style="margin:0;font-size:12px;color:#8a99ab;">Seven Seas Operations · sent on behalf of ${orgLabel}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${orgLabel} <${FROM_EMAIL}>`,
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
