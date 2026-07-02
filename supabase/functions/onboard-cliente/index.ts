// Onboarding di un cliente: crea (o riusa) il lido, la griglia ombrelloni base,
// invita il gestore/staff via email e lo collega al lido con il ruolo scelto.
// Richiamata dal frontend con supabase.functions.invoke("onboard-cliente", { body }).
// Riservata ai super-admin: il ruolo del chiamante viene verificato qui perché questa
// funzione usa la service role key (bypassa le RLS) per invitare l'utente.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Ruolo = "gestore" | "staff";

type RequestBody = {
  lidoId?: string; // se presente: invita su lido esistente, non crea nulla
  nomeStabilimento?: string;
  emailGestore?: string;
  numeroOmbrelloni?: number;
  ruolo?: Ruolo;
};

type Fila = { index: number; label: string; ombrelloni: { numero: number }[] };

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function slugify(nome: string): string {
  const base = nome
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "lido";
}

function buildGrid(totale: number, perRow = 8): { numero_file: number; file: Fila[] } {
  const righe = Math.ceil(totale / perRow);
  const file: Fila[] = [];
  let contatore = 1;
  for (let i = 0; i < righe; i++) {
    const size = Math.min(perRow, totale - i * perRow);
    const ombrelloni = Array.from({ length: size }, () => ({ numero: contatore++ }));
    file.push({ index: i, label: `Fila ${String.fromCharCode(65 + i)}`, ombrelloni });
  }
  return { numero_file: righe, file };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Non autorizzato." }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await callerClient.auth.getUser();
    if (userError || !userData.user) return json({ error: "Sessione non valida o scaduta." }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: roles, error: rolesError } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    if (rolesError) return json({ error: "Impossibile verificare i permessi." }, 500);
    const isSuperAdmin = (roles ?? []).some((r) => r.role === "super_admin");
    if (!isSuperAdmin) return json({ error: "Accesso riservato ai super-admin." }, 403);

    const body = (await req.json()) as RequestBody;
    const email = (body.emailGestore ?? "").trim().toLowerCase();
    const ruolo: Ruolo = body.ruolo === "staff" ? "staff" : "gestore";
    const lidoIdEsistente = (body.lidoId ?? "").trim();

    if (!email || !email.includes("@")) return json({ error: "Email non valida." }, 400);

    let lido: { id: string; nome: string; slug: string } | null = null;
    let ombrelloniCreati = 0;

    if (lidoIdEsistente) {
      // Modalità: invita utente su un lido GIÀ esistente. Non crea nulla.
      const { data: lidoEsistente, error: lidoFetchError } = await admin
        .from("lidi")
        .select("id, nome, slug")
        .eq("id", lidoIdEsistente)
        .maybeSingle();
      if (lidoFetchError) return json({ error: lidoFetchError.message }, 500);
      if (!lidoEsistente) return json({ error: "Lido non trovato." }, 404);
      lido = lidoEsistente;
    } else {
      // Modalità: crea un NUOVO lido (flusso onboarding originale).
      const nome = (body.nomeStabilimento ?? "").trim();
      const numeroOmbrelloni = Math.max(0, Math.floor(body.numeroOmbrelloni ?? 0));
      if (!nome) return json({ error: "Il nome dello stabilimento è obbligatorio." }, 400);

      // 1. Crea il lido (retry con suffisso se lo slug è già in uso)
      const baseSlug = slugify(nome);
      let slug = baseSlug;
      let lidoError: { code?: string; message: string } | null = null;

      for (let tentativo = 0; tentativo < 5; tentativo++) {
        const { data, error } = await admin
          .from("lidi")
          .insert({ nome, slug })
          .select("id, nome, slug")
          .single();
        if (!error) {
          lido = data;
          break;
        }
        lidoError = error;
        if (error.code === "23505") {
          slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
          continue;
        }
        break;
      }

      if (!lido) {
        return json(
          { error: lidoError?.message ?? "Impossibile creare lo stabilimento." },
          400,
        );
      }

      // 2. Griglia ombrelloni base (se richiesta)
      if (numeroOmbrelloni > 0) {
        const { numero_file, file } = buildGrid(numeroOmbrelloni);
        const { error: bcError } = await admin.from("beach_config").insert({
          lido_id: lido.id,
          numero_file,
          numerazione: "auto_lr",
          file,
        });
        if (bcError) {
          return json(
            {
              error: `Stabilimento creato, ma la configurazione degli ombrelloni non è riuscita: ${bcError.message}`,
              lido,
            },
            500,
          );
        }
        ombrelloniCreati = numeroOmbrelloni;
      }
    }

    // 3. Invita l'utente
    const appUrl = Deno.env.get("APP_URL") ?? "https://ombrellone.app";
    const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${appUrl}/accetta-invito`,
    });

    if (inviteError || !inviteData?.user) {
      const raw = inviteError?.message ?? "";
      const message = raw.toLowerCase().includes("already registered") || raw.toLowerCase().includes("already been registered")
        ? "Questa email ha già un account o è già stata invitata."
        : raw || "Impossibile inviare l'invito.";
      return json({ error: message, lido }, 409);
    }

    // 4. Collega l'utente invitato al lido con il ruolo scelto
    const { error: roleError } = await admin.from("user_roles").insert({
      user_id: inviteData.user.id,
      lido_id: lido!.id,
      role: ruolo,
    });

    if (roleError) {
      return json(
        { error: `Invito inviato, ma l'assegnazione del ruolo non è riuscita: ${roleError.message}`, lido, email },
        500,
      );
    }

    return json(
      {
        lido: { id: lido!.id, nome: lido!.nome, slug: lido!.slug },
        email,
        ruolo,
        ombrelloniCreati,
      },
      200,
    );
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Errore imprevisto." }, 500);
  }
});
