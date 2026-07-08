// Invia le email del modulo prenotazioni (conferma cliente + notifica gestore
// alla creazione, avviso scadenza al cliente quando il cron le fa scadere).
// Chiamata da Postgres via pg_net (vedi supabase/migrations), non dal frontend:
// l'autenticazione è un segreto condiviso (x-webhook-secret), non un JWT utente,
// perché il chiamante è pg_net e non un utente loggato. Stesso pattern di
// notify-contact.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

const NAVY = "#1B3A6B";
const TEAL = "#2DD4BF";

type EventType = "created" | "expired";

type RequestBody = {
  booking_id?: string;
  event_type?: EventType;
};

type Booking = {
  id: string;
  lido_id: string;
  nome: string;
  cognome: string;
  email: string;
  telefono: string | null;
  data: string; // date, "YYYY-MM-DD"
  fila: string;
  numero_ombrellone: string;
  expires_at: string | null;
};

type Lido = {
  id: string;
  nome: string;
  slug: string;
  email: string | null;
  auto_email_enabled: boolean;
};

type Template = {
  subject_cliente: string;
  body_cliente: string;
  subject_gestore: string;
  body_gestore: string;
};

// Stesso testo di default mostrato in impostazioni.tsx (BookingEmailTemplateCard)
// quando non esiste ancora una riga in booking_email_templates per il lido:
// deve restare identico così che il default "visto" in UI e quello realmente
// inviato coincidano.
const DEFAULT_TEMPLATE: Template = {
  subject_cliente: "Prenotazione confermata - {{lido_nome}}",
  body_cliente:
    "Ciao {{nome}},\n\nla tua prenotazione per il {{data}} è confermata: {{fila}}, ombrellone {{numero_ombrellone}}.\nTi aspettiamo entro le {{ora_scadenza}}, altrimenti il posto potrebbe essere riassegnato.\n\nA presto,\n{{lido_nome}}",
  subject_gestore: "Nuova prenotazione - {{fila}} {{numero_ombrellone}} il {{data}}",
  body_gestore:
    "Nuova prenotazione da {{nome}} {{cognome}} per il {{data}}.\n{{fila}}, ombrellone {{numero_ombrellone}}.\nScadenza check-in: {{ora_scadenza}}.\nTelefono cliente: {{telefono}}",
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
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Sostituzione senza escaping, per l'oggetto (testo semplice, non HTML).
function renderPlain(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_m, key) => vars[key] ?? "");
}

// Sostituzione con escaping HTML dei valori (i dati del cliente arrivano da un
// form pubblico anonimo), poi newline -> <br> per il corpo email.
function renderHtmlBody(template: string, vars: Record<string, string>): string {
  const substituted = template.replace(/\{\{(\w+)\}\}/g, (_m, key) => {
    const v = vars[key];
    return v !== undefined ? escapeHtml(v) : "";
  });
  return substituted.replace(/\n/g, "<br>");
}

function wrapEmailHtml(lidoNome: string, bodyHtml: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="background:linear-gradient(135deg, ${NAVY}, ${TEAL});padding:20px 24px;">
                <span style="color:#ffffff;font-size:18px;font-weight:700;">${escapeHtml(lidoNome)}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:24px;color:#1f2937;font-size:15px;line-height:1.6;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px;background-color:#f4f5f7;color:#9ca3af;font-size:12px;">
                Inviata automaticamente da OmbrellOne per conto di ${escapeHtml(lidoNome)}.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function formatDataItaliana(dataIso: string): string {
  const [y, m, d] = dataIso.split("-");
  if (!y || !m || !d) return dataIso;
  return `${d}/${m}/${y}`;
}

function formatOraScadenza(expiresAtIso: string | null): string {
  if (!expiresAtIso) return "-";
  try {
    return new Intl.DateTimeFormat("it-IT", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Rome",
    }).format(new Date(expiresAtIso));
  } catch {
    return "-";
  }
}

async function sendViaResend(
  resendApiKey: string,
  to: string,
  subject: string,
  html: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "OmbrellOne <ciao@ombrellone.app>",
      to: [to],
      subject,
      html,
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    return { ok: false, error: errText };
  }
  return { ok: true };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const sharedSecret = Deno.env.get("BOOKING_EMAIL_WEBHOOK_SECRET");
    const providedSecret = req.headers.get("x-webhook-secret");
    if (!sharedSecret || providedSecret !== sharedSecret) {
      return json({ error: "Non autorizzato." }, 401);
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) return json({ error: "RESEND_API_KEY non configurata." }, 500);

    const body = (await req.json()) as RequestBody;
    const bookingId = (body.booking_id ?? "").trim();
    const eventType = body.event_type;
    if (!bookingId) return json({ error: "booking_id mancante." }, 400);
    if (eventType !== "created" && eventType !== "expired") {
      return json({ error: "event_type non valido." }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: booking, error: bookingError } = await admin
      .from("bookings")
      .select("id, lido_id, nome, cognome, email, telefono, data, fila, numero_ombrellone, expires_at")
      .eq("id", bookingId)
      .maybeSingle<Booking>();
    if (bookingError) return json({ error: bookingError.message }, 500);
    if (!booking) return json({ error: "Prenotazione non trovata." }, 404);
    if (!booking.email) return json({ ok: true, skipped: "no_email" }, 200);

    const { data: lido, error: lidoError } = await admin
      .from("lidi")
      .select("id, nome, slug, email, auto_email_enabled")
      .eq("id", booking.lido_id)
      .maybeSingle<Lido>();
    if (lidoError) return json({ error: lidoError.message }, 500);
    if (!lido) return json({ error: "Stabilimento non trovato." }, 404);

    if (!lido.auto_email_enabled) {
      return json({ ok: true, skipped: "auto_email_disabled" }, 200);
    }

    const vars: Record<string, string> = {
      nome: booking.nome,
      cognome: booking.cognome,
      telefono: booking.telefono ?? "-",
      data: formatDataItaliana(booking.data),
      fila: booking.fila,
      numero_ombrellone: booking.numero_ombrellone,
      ora_scadenza: formatOraScadenza(booking.expires_at),
      lido_nome: lido.nome,
    };

    const results: Record<string, unknown> = {};

    if (eventType === "created") {
      const { data: tplRow } = await admin
        .from("booking_email_templates")
        .select("subject_cliente, body_cliente, subject_gestore, body_gestore")
        .eq("lido_id", lido.id)
        .maybeSingle<Template>();
      const tpl = tplRow ?? DEFAULT_TEMPLATE;

      const clienteSubject = renderPlain(tpl.subject_cliente, vars);
      const clienteHtml = wrapEmailHtml(lido.nome, renderHtmlBody(tpl.body_cliente, vars));
      results.cliente = await sendViaResend(resendApiKey, booking.email, clienteSubject, clienteHtml);

      if (lido.email) {
        const gestoreSubject = renderPlain(tpl.subject_gestore, vars);
        const gestoreHtml = wrapEmailHtml(lido.nome, renderHtmlBody(tpl.body_gestore, vars));
        results.gestore = await sendViaResend(resendApiKey, lido.email, gestoreSubject, gestoreHtml);
      } else {
        results.gestore = { ok: true, skipped: "no_lido_email" };
      }
    } else {
      const subject = renderPlain("La tua prenotazione è scaduta - {{lido_nome}}", vars);
      const rebookUrl = `${Deno.env.get("APP_URL") ?? "https://ombrellone.app"}/lido/${lido.slug}/prenota`;
      const bodyTemplate =
        "Ciao {{nome}},\n\nla tua prenotazione per il {{data}} ({{fila}}, ombrellone {{numero_ombrellone}}) è scaduta perché non è arrivata conferma entro l'orario previsto, e il posto è tornato disponibile.\n\nSe vuoi ancora venire da noi, puoi prenotare di nuovo qui:\n" +
        rebookUrl +
        "\n\nA presto,\n{{lido_nome}}";
      const html = wrapEmailHtml(lido.nome, renderHtmlBody(bodyTemplate, vars));
      results.cliente = await sendViaResend(resendApiKey, booking.email, subject, html);
    }

    return json({ ok: true, results }, 200);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Errore imprevisto." }, 500);
  }
});
