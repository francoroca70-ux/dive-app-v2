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
    const { to, fullName, orgName, role, inviteUrl } = body || {};

    if (!to || !inviteUrl) {
      return new Response(JSON.stringify({ error: "Missing recipient email or invite link" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const roleLabel = (role || "crew").toString().replace(/_/g, " ")
      .replace(/\b\w/g, (c: string) => c.toUpperCase());
    const orgLabel = orgName || "Seven Seas";

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
              <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#4fc3f7;">Crew Invitation</p>
              <h1 style="margin:0 0 20px;font-size:22px;line-height:1.3;color:#0a1628;">You're invited to join ${orgLabel}</h1>
              <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#1a2a3a;">Hi ${fullName || "there"},</p>
              <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#1a2a3a;">
                ${orgLabel} added you as <strong>${roleLabel}</strong> on Seven Seas — the app the team uses to run day-to-day operations: trip schedules, checklists, digital waivers, and gear tracking, all in one place, even without wifi at the dock.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f8ff;border-radius:10px;">
                <tr>
                  <td style="padding:20px 22px;">
                    <p style="margin:0 0 12px;font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#1a6b8a;">Next steps</p>
                    <p style="margin:0 0 8px;font-size:14px;line-height:1.5;color:#1a2a3a;">1. Tap the button below and set a password for your account.</p>
                    <p style="margin:0 0 8px;font-size:14px;line-height:1.5;color:#1a2a3a;">2. Open Seven Seas from your phone's browser — no download needed, it works like an app.</p>
                    <p style="margin:0;font-size:14px;line-height:1.5;color:#1a2a3a;">3. You'll see today's trips and any tasks assigned to you as soon as you log in.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:28px 32px 8px;">
              <a href="${inviteUrl}" style="background:#1a6b8a;color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">Set up your account</a>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 32px;">
              <p style="margin:0 0 4px;font-size:12px;color:#8a99ab;">If the button doesn't work, copy and paste this link into your browser:</p>
              <p style="margin:0;font-size:12px;color:#1a6b8a;word-break:break-all;">${inviteUrl}</p>
              <p style="margin:24px 0 0;font-size:14px;color:#1a2a3a;">Welcome aboard — see you on the water.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 32px;border-top:1px solid #eef2f6;">
              <p style="margin:0;font-size:12px;color:#8a99ab;">This invite was sent by ${orgLabel} via Seven Seas.</p>
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
        subject: `You're invited to join ${orgLabel}`,
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
