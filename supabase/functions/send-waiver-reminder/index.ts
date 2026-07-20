// Supabase Edge Function: send-waiver-reminder
// Sends a targeted "you're still missing a waiver" reminder email for one
// guest inside a booking group. Seven Seas' booking model has one
// contact_email per group (not per participant), so this still goes to the
// group's contact email — it just names the specific guest who's still
// missing something, so staff can nudge one person without re-sending the
// whole group's booking confirmation. Called from index.html's
// remindWaiverGuest() via sb.functions.invoke('send-waiver-reminder', { body: {...} }).
//
// Required secret (same one already used by send-booking-confirmation):
//   RESEND_API_KEY
// Optional secret:
//   RESEND_FROM_EMAIL — defaults to onboarding@resend.dev until a verified
//   sending domain is set up.

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
    const { to, guestName, groupContactName, orgName, waiverLink } = body || {};

    if (!to || !waiverLink) {
      return new Response(JSON.stringify({ error: "Missing recipient email or waiver link" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;">
        <h2 style="color:#1a6b8a;">Waiver reminder${orgName ? " — " + orgName : ""}</h2>
        <p>Hi ${groupContactName || "there"},</p>
        <p><strong>${guestName || "One guest"}</strong> in your booking still needs to sign a waiver before the trip.</p>
        <p style="margin:16px 0;">
          <a href="${waiverLink}" style="background:#1a6b8a;color:#ffffff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">Sign now</a>
        </p>
        <p style="color:#888;font-size:0.85em;">If the button doesn't work, copy and paste this link into your browser:<br>${waiverLink}</p>
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
        subject: `Reminder — please sign ${guestName ? guestName + "'s" : "your"} waiver`,
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
