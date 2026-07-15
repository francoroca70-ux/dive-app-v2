// Supabase Edge Function: send-staff-invite
// Sends a branded "you've been invited" email via Resend when an owner/manager invites
// a new crew member from Settings -> Crew. Called from index.html via
// sb.functions.invoke('send-staff-invite', { body: {...} }).
//
// Required secret (same one already set up for send-booking-confirmation):
//   RESEND_API_KEY        - your Resend API key
// Optional secret:
//   RESEND_FROM_EMAIL     - defaults to onboarding@resend.dev (Resend's test sender,
//                            which only delivers to your own verified Resend account
//                            email until you verify your own domain).

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
    const { to, fullName, orgName, role, inviteUrl } = body || {};

    if (!to || !inviteUrl) {
      return new Response(JSON.stringify({ error: "Missing recipient email or invite link" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const roleLabel = (role || "crew").toString().replace(/_/g, " ");

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;">
        <h2 style="color:#1a6b8a;">You're invited${orgName ? " to join " + orgName : ""}</h2>
        <p>Hi ${fullName || "there"},</p>
        <p>You've been added as <strong>${roleLabel}</strong>${orgName ? " on " + orgName + "'s" : ""} Seven Seas account. Set up your account to get started:</p>
        <p style="margin:24px 0;">
          <a href="${inviteUrl}" style="background:#1a6b8a;color:#ffffff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">Set up your account</a>
        </p>
        <p style="color:#888;font-size:0.85em;">If the button doesn't work, copy and paste this link into your browser:<br>${inviteUrl}</p>
      </div>
    `;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${orgName || "Seven Seas"} <${FROM_EMAIL}>`,
        to: [to],
        subject: `You're invited to join ${orgName || "Seven Seas"}`,
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
