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
      // 'medical' is deliberately never offered remotely. The medical
      // declaration is a paper form the guest fills in at the shop, and the
      // clearance that follows is recorded by staff who actually read it --
      // letting a guest self-certify from their phone would defeat the point
      // of the check, and we no longer store any medical content anyway.
      requiredTypes = requiredTypes.filter((type) => type !== "medical");

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
    // Fetches the actual wording for one waiver type, on demand -- kept out of
    // `status` since most participants only end up opening one or two of
    // these, not every type up front.
    if (action === "template") {
      const { waiverType } = body || {};
      if (!waiverType) return json({ error: "Missing waiverType" }, 400);
      if (waiverType === "medical") return json({ error: "Not signable remotely" }, 400);

      const { data: template } = await sb
        .from("waiver_templates")
        .select("*")
        .eq("org_id", link.org_id)
        .eq("waiver_type", waiverType)
        .maybeSingle();

      return json({ template: template || null });
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
        templateId, bodySnapshot, signedAt, offline,
      } = body || {};

      if (!participantId || !waiverType || !printedName || !signedDate) {
        return json({ error: "Missing required fields" }, 400);
      }
      // Belt and braces: the list action already filters medical out, so a
      // request for one here means a hand-crafted payload.
      if (waiverType === "medical") return json({ error: "Not signable remotely" }, 400);

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

      // ─── Firma sin conexión (quiosco) ───
      //
      // Cuando la tablet del centro firma sin internet, la fila llega minutos
      // u horas después. Dos cosas NO se pueden fingir en ese caso:
      //
      //   signed_at  — la hora real es la del dispositivo, no la del servidor.
      //                Guardar la hora de sincronización sería registrar una
      //                hora falsa en un documento legal.
      //   IP y user agent — los del momento de sincronizar, que pueden ser de
      //                otro aparato y otra red. Se guardan en null: un dato
      //                que no significa lo que parece es peor que ninguno.
      //
      // Y se marca signed_via = 'kiosk_offline' para que la línea de
      // procedencia pueda decir la verdad: que la hora la informó el
      // dispositivo y nadie la verificó de forma independiente.
      const isOffline = offline === true;

      let signedAtValue: string | null = null;
      if (isOffline) {
        if (!signedAt) return json({ error: "Missing signedAt for an offline signature" }, 400);
        const when = new Date(signedAt);
        if (isNaN(when.getTime())) return json({ error: "Invalid signedAt" }, 400);
        const now = Date.now();
        // Cinco minutos de tolerancia hacia adelante por relojes desfasados;
        // más que eso es un reloj mal puesto o un payload armado a mano.
        if (when.getTime() > now + 5 * 60 * 1000) {
          return json({ error: "signedAt is in the future" }, 400);
        }
        // Siete días: una cola que no se vació en una semana no es una tablet
        // sin señal, es otra cosa. Que falle ruidosamente.
        if (when.getTime() < now - 7 * 24 * 60 * 60 * 1000) {
          return json({ error: "signedAt is too old to accept" }, 400);
        }
        signedAtValue = when.toISOString();
      }

      const ip = isOffline ? null : (req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null);
      const userAgent = isOffline ? null : (req.headers.get("user-agent") || null);

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
        signed_via: isOffline ? "kiosk_offline" : "remote",
        signer_ip: ip,
        signer_user_agent: userAgent,
        ...(signedAtValue ? { signed_at: signedAtValue } : {}),
      });

      // 23505 = índice único (un formulario por participante y tipo). Si la
      // cola se reenvía porque la respuesta se perdió en el camino, el
      // segundo intento choca acá. Eso NO es un error: la firma ya está
      // guardada. Devolverlo como éxito es lo que hace que reintentar sea
      // seguro -- si devolviera 500, la cola reintentaría para siempre.
      if (error) {
        if ((error as any).code === "23505") return json({ success: true, duplicate: true });
        return json({ error: error.message }, 500);
      }
      return json({ success: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
