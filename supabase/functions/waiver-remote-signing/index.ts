// Supabase Edge Function: waiver-remote-signing
// Powers the public, no-login signing page reached via a link in the booking
// confirmation email (index.html?waiver=TOKEN). Runs entirely on the service
// role key so the browser's anon key never needs direct RLS access to
// waivers/participants/trip_groups/waiver_templates for this flow -- every
// read and write is funneled through the three actions below, each of which
// re-validates the token and scopes every query to that one booking group.
//
// Called from index.html via sb.functions.invoke('waiver-remote-signing', { body: {...} }).
// No secrets need to be set manually -- SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY are automatically available to every edge function.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
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

function calcAge(dob: string | null): number | null {
  if (!dob) return null;
  const b = new Date(dob + "T12:00:00");
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    const body = await req.json();
    const { action, token } = body || {};
    if (!action || !token) {
      return json({ error: "Missing action or token" }, 400);
    }

    // Every action starts by resolving + validating the token the same way.
    const { data: link } = await sb
      .from("waiver_signing_links")
      .select("id, org_id, group_id, expires_at")
      .eq("token", token)
      .maybeSingle();

    // Include `error` alongside `valid`/`reason` so every action (not just
    // `status`) fails safely on the client's generic `data?.error` check.
    if (!link) return json({ valid: false, error: "not_found", reason: "not_found" });
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return json({ valid: false, error: "expired", reason: "expired" });
    }

    // ─── action: status ───
    // Returns the group's trip info plus each participant's required waiver
    // types and which of those are already signed (in person or remotely).
    if (action === "status") {
      const { data: group } = await sb
        .from("trip_groups")
        .select("id, contact_name, trip_id, trips(trip_type, trip_type_id, trip_date, trip_time, location_id, boats(name))")
        .eq("id", link.group_id)
        .single();

      const { data: org } = await sb.from("organizations").select("name").eq("id", link.org_id).single();

      const tripTypeId = (group as any)?.trips?.trip_type_id || null;
      let requiredTypes: string[] = ["liability"];
      if (tripTypeId) {
        const { data: tt } = await sb.from("trip_types").select("required_waiver_types").eq("id", tripTypeId).maybeSingle();
        if (tt?.required_waiver_types?.length) requiredTypes = tt.required_waiver_types;
      }

      const { data: participants } = await sb
        .from("participants")
        .select("id, full_name, date_of_birth")
        .eq("group_id", link.group_id);

      const participantIds = (participants || []).map((p) => p.id);
      const signedByParticipant: Record<string, Set<string>> = {};
      if (participantIds.length) {
        const { data: signed } = await sb
          .from("waivers")
          .select("participant_id, waiver_type")
          .in("participant_id", participantIds);
        (signed || []).forEach((s) => {
          if (!s.participant_id) return;
          if (!signedByParticipant[s.participant_id]) signedByParticipant[s.participant_id] = new Set();
          signedByParticipant[s.participant_id].add(s.waiver_type);
        });
      }

      const participantsOut = (participants || []).map((p) => {
        const signedSet = signedByParticipant[p.id] || new Set();
        return {
          id: p.id,
          full_name: p.full_name,
          is_minor: (calcAge(p.date_of_birth) ?? 99) < 18,
          waivers: requiredTypes.map((type) => ({ type, signed: signedSet.has(type) })),
        };
      });

      return json({
        valid: true,
        org: { name: org?.name || "" },
        trip: {
          tripType: (group as any)?.trips?.trip_type || "Trip",
          tripDate: (group as any)?.trips?.trip_date || "",
          tripTime: (group as any)?.trips?.trip_time || "",
          boatName: (group as any)?.trips?.boats?.name || "",
        },
        groupContactName: group?.contact_name || "",
        participants: participantsOut,
      });
    }

    // ─── action: template ───
    // Fetches the actual wording (or medical questionnaire) for one waiver
    // type, on demand -- kept out of `status` since most participants only
    // end up opening one or two of these, not every type up front.
    if (action === "template") {
      const { waiverType } = body || {};
      if (!waiverType) return json({ error: "Missing waiverType" }, 400);

      const { data: template } = await sb
        .from("waiver_templates")
        .select("*")
        .eq("org_id", link.org_id)
        .eq("waiver_type", waiverType)
        .maybeSingle();

      let questions: unknown[] = [];
      if (waiverType === "medical" && template) {
        const { data: qs } = await sb
          .from("waiver_template_questions")
          .select("*")
          .eq("template_id", template.id)
          .order("sort_order");
        questions = qs || [];
      }

      return json({ template: template || null, questions });
    }

    // ─── action: sign ───
    // Validates the participant genuinely belongs to this token's group
    // (never trust participant_id from the client alone), then inserts the
    // signature exactly like the in-app staff flow does, just tagged
    // signed_via: 'remote' with an IP/user-agent for the audit trail.
    if (action === "sign") {
      const {
        participantId, waiverType, printedName, signedDate, signatureData,
        guardianName, guardianDate, guardianSignatureData, notes,
        templateId, bodySnapshot, responses,
      } = body || {};

      if (!participantId || !waiverType || !printedName || !signedDate) {
        return json({ error: "Missing required fields" }, 400);
      }

      const { data: participant } = await sb
        .from("participants")
        .select("id, trip_id, group_id")
        .eq("id", participantId)
        .eq("group_id", link.group_id)
        .maybeSingle();
      if (!participant) return json({ error: "Participant does not belong to this booking" }, 403);

      const { data: group } = await sb
        .from("trip_groups")
        .select("trips(location_id)")
        .eq("id", link.group_id)
        .single();
      const locationId = (group as any)?.trips?.location_id || null;

      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
      const userAgent = req.headers.get("user-agent") || null;

      const { error } = await sb.from("waivers").insert({
        org_id: link.org_id,
        location_id: locationId,
        participant_id: participantId,
        group_id: link.group_id,
        trip_id: participant.trip_id || null,
        waiver_type: waiverType,
        method: "digital",
        signature_data: signatureData || null,
        participant_printed_name: printedName,
        participant_signed_date: signedDate,
        guardian_printed_name: guardianName || null,
        guardian_signed_date: guardianDate || null,
        guardian_signature_data: guardianSignatureData || null,
        notes: notes || null,
        signed_by_name: null,
        template_id: templateId || null,
        body_snapshot: bodySnapshot || null,
        responses: responses || null,
        signed_via: "remote",
        signer_ip: ip,
        signer_user_agent: userAgent,
      });

      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
