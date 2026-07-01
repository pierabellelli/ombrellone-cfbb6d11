// Notifica via email quando arriva un nuovo contatto dal form della landing page.
// Chiamata dal trigger Postgres su public.contatti (vedi supabase/migrations),
// non dal frontend: l'autenticazione è un segreto condiviso, non un JWT utente,
// perché il chiamante è pg_net e non un utente loggato.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

type ContattoPayload = {
  nome?: string;
  email?: string;
  nome_lido?: string;
  citta?: string;
  messaggio?: string | null;
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
    const sharedSecret = Deno.env.get("WEBHOOK_SHARED_SECRET");
    const providedSecret = req.headers.get("x-webhook-secret");
    if (!sharedSecret || providedSecret !== sharedSecret) {
      return json({ error: "Non autorizzato." }, 401);
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) return json({ error: "RESEND_API_KEY non configurata." }, 500);

    const payload = (await req.json()) as ContattoPayload;
    const nome = (payload.nome ?? "").trim();
    const email = (payload.email ?? "").trim();
    const nomeLido = (payload.nome_lido ?? "").trim();
    const citta = (payload.citta ?? "").trim();
    const messaggio = (payload.messaggio ?? "").trim();

    const subject = `Nuova richiesta demo da ${nomeLido || "uno stabilimento"}`;
    const html = `
      <h2>Nuova richiesta demo</h2>
      <p><strong>Nome:</strong> ${escapeHtml(nome)}</p>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p><strong>Nome lido:</strong> ${escapeHtml(nomeLido)}</p>
      <p><strong>Città:</strong> ${escapeHtml(citta)}</p>
      <p><strong>Messaggio:</strong><br>${messaggio ? escapeHtml(messaggio).replace(/\n/g, "<br>") : "—"}</p>
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
