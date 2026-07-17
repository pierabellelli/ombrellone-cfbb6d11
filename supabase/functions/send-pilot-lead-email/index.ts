// Notifica via email quando arriva una nuova candidatura al Programma Pilota.
// Chiamata dal trigger Postgres su public.pilot_leads (vedi supabase/migrations),
// non dal frontend: l'autenticazione è un segreto condiviso, non un JWT utente,
// perché il chiamante è pg_net e non un utente loggato.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

type PilotLeadPayload = {
  nome?: string;
  cognome?: string;
  nome_lido?: string;
  localita?: string;
  telefono?: string;
  email?: string;
  numero_ombrelloni?: number;
  bar_attivo?: boolean;
  note?: string | null;
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const sharedSecret = Deno.env.get("PILOT_LEAD_WEBHOOK_SECRET");
    const providedSecret = req.headers.get("x-webhook-secret");
    if (!sharedSecret || providedSecret !== sharedSecret) {
      return json({ error: "Non autorizzato." }, 401);
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) return json({ error: "RESEND_API_KEY non configurata." }, 500);

    const payload = (await req.json()) as PilotLeadPayload;
    const nome = (payload.nome ?? "").trim();
    const cognome = (payload.cognome ?? "").trim();
    const nomeLido = (payload.nome_lido ?? "").trim();
    const localita = (payload.localita ?? "").trim();
    const telefono = (payload.telefono ?? "").trim();
    const email = (payload.email ?? "").trim();
    const numeroOmbrelloni = payload.numero_ombrelloni ?? 0;
    const barAttivo = payload.bar_attivo ?? false;
    const note = (payload.note ?? "").trim();

    const subject = `Nuova candidatura pilota: ${nomeLido || "uno stabilimento"} (${localita || "località non indicata"})`;
    const html = `
      <h2>Nuova candidatura Programma Pilota</h2>
      <p><strong>Nome:</strong> ${escapeHtml(nome)} ${escapeHtml(cognome)}</p>
      <p><strong>Lido:</strong> ${escapeHtml(nomeLido)}</p>
      <p><strong>Località:</strong> ${escapeHtml(localita)}</p>
      <p><strong>Telefono:</strong> ${escapeHtml(telefono)}</p>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p><strong>Numero ombrelloni:</strong> ${numeroOmbrelloni}</p>
      <p><strong>Bar attivo:</strong> ${barAttivo ? "Sì" : "No"}</p>
      <p><strong>Note:</strong><br>${note ? escapeHtml(note).replace(/\n/g, "<br>") : "—"}</p>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "OmbrellOne <ciao@ombrellone.app>",
        to: ["ciao@ombrellone.app"],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return json({ error: `Resend ha rifiutato l'invio: ${errText}` }, 502);
    }

    return json({ ok: true }, 200);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Errore imprevisto." }, 500);
  }
});
