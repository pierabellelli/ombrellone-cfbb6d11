import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, UserPlus, CheckCircle2, LayoutDashboard, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/admin/nuovo-cliente")({
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/login" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
    const isSuperAdmin = (roles ?? []).some((r) => r.role === "super_admin");
    if (!isSuperAdmin) throw redirect({ to: "/ordini" });
  },
  head: () => ({ meta: [{ title: "Nuovo cliente · OmbrellOne" }] }),
  component: NuovoClientePage,
});

type Ruolo = "gestore" | "staff";
type Modalita = "nuovo" | "esistente";

type LidoOption = { id: string; nome: string; slug: string };

type Riepilogo = {
  nomeLido: string;
  email: string;
  ruolo: Ruolo;
  ombrelloniCreati: number;
};

async function fetchLidi(): Promise<LidoOption[]> {
  const { data, error } = await supabase.from("lidi").select("id, nome, slug").order("nome", { ascending: true });
  if (error) throw error;
  return (data ?? []) as LidoOption[];
}

function NuovoClientePage() {
  const [modalita, setModalita] = useState<Modalita>("nuovo");
  const [lidoEsistenteId, setLidoEsistenteId] = useState<string>("");
  const [nomeStabilimento, setNomeStabilimento] = useState("");
  const [emailGestore, setEmailGestore] = useState("");
  const [numeroOmbrelloni, setNumeroOmbrelloni] = useState("0");
  const [ruolo, setRuolo] = useState<Ruolo>("gestore");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [riepilogo, setRiepilogo] = useState<Riepilogo | null>(null);

  const { data: lidi = [], isLoading: lidiLoading } = useQuery({
    queryKey: ["lidiEsistenti"],
    queryFn: fetchLidi,
    enabled: modalita === "esistente",
  });

  const resetForm = () => {
    setModalita("nuovo");
    setLidoEsistenteId("");
    setNomeStabilimento("");
    setEmailGestore("");
    setNumeroOmbrelloni("0");
    setRuolo("gestore");
    setRiepilogo(null);
    setFormError(null);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const nome = nomeStabilimento.trim();
    const email = emailGestore.trim();
    const numero = Math.max(0, Math.floor(Number(numeroOmbrelloni) || 0));

    if (!email || !email.includes("@")) {
      setFormError("Inserisci un'email valida.");
      return;
    }
    if (modalita === "nuovo" && !nome) {
      setFormError("Il nome dello stabilimento è obbligatorio.");
      return;
    }
    if (modalita === "esistente" && !lidoEsistenteId) {
      setFormError("Seleziona un lido esistente.");
      return;
    }

    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("onboard-cliente", {
      body:
        modalita === "esistente"
          ? { lidoId: lidoEsistenteId, emailGestore: email, ruolo }
          : { nomeStabilimento: nome, emailGestore: email, numeroOmbrelloni: numero, ruolo },
    });
    setSubmitting(false);

    if (error || data?.error) {
      const description = data?.error ?? error?.message ?? "Errore imprevisto.";
      toast.error("Invito non riuscito", { description });
      return;
    }

    setRiepilogo({
      nomeLido: data.lido.nome,
      email: data.email,
      ruolo: data.ruolo,
      ombrelloniCreati: data.ombrelloniCreati,
    });
    toast.success(modalita === "esistente" ? "Utente invitato con successo" : "Cliente creato con successo");
  };

  return (
    <div className="max-w-[640px] mx-auto px-4 md:px-6 py-6">
      <Link to="/admin/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition">
        <ArrowLeft className="w-4 h-4" /> Torna alla dashboard
      </Link>

      <div className="flex items-center justify-between flex-wrap gap-3 mt-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-primary">Nuovo cliente</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Crea uno stabilimento e invita il gestore, oppure invita un utente su un lido già esistente.
          </p>
        </div>
        <nav className="inline-flex rounded-full border border-border bg-card p-1 text-sm font-medium shrink-0">
          <Link to="/admin/dashboard" className="px-3.5 py-1.5 rounded-full text-muted-foreground hover:text-foreground transition inline-flex items-center gap-1.5">
            <LayoutDashboard className="w-3.5 h-3.5" /> Dashboard
          </Link>
          <span className="px-3.5 py-1.5 rounded-full bg-primary text-primary-foreground inline-flex items-center gap-1.5">
            <UserPlus className="w-3.5 h-3.5" /> Nuovo cliente
          </span>
        </nav>
      </div>

      {riepilogo ? (
        <div className="card-soft p-6 md:p-8 mt-6 text-center">
          <CheckCircle2 className="w-10 h-10 text-[color:var(--teal-deep)] mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-primary">Invito completato</h2>
          <div className="mt-4 text-left text-sm space-y-2 bg-[color:var(--teal)]/10 border border-[color:var(--teal-deep)]/20 rounded-lg p-4">
            <p><span className="font-medium">Stabilimento:</span> {riepilogo.nomeLido}</p>
            <p><span className="font-medium">Invito inviato a:</span> {riepilogo.email}</p>
            <p><span className="font-medium">Ruolo assegnato:</span> {riepilogo.ruolo === "gestore" ? "Gestore" : "Staff"}</p>
            {riepilogo.ombrelloniCreati > 0 && (
              <p><span className="font-medium">Ombrelloni creati:</span> {riepilogo.ombrelloniCreati}</p>
            )}
          </div>
          <button
            onClick={resetForm}
            className="mt-6 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg brand-gradient text-white font-medium"
          >
            <UserPlus className="w-4 h-4" /> Aggiungi un altro invito
          </button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="card-soft p-6 md:p-8 mt-6 space-y-4">
          <div className="inline-flex rounded-lg border border-border overflow-hidden w-full">
            <button
              type="button"
              onClick={() => setModalita("nuovo")}
              className={`flex-1 px-3 py-2 text-sm font-medium transition ${
                modalita === "nuovo" ? "bg-primary text-primary-foreground" : "bg-card text-foreground hover:bg-secondary"
              }`}
            >
              Nuovo lido
            </button>
            <button
              type="button"
              onClick={() => setModalita("esistente")}
              className={`flex-1 px-3 py-2 text-sm font-medium transition ${
                modalita === "esistente" ? "bg-primary text-primary-foreground" : "bg-card text-foreground hover:bg-secondary"
              }`}
            >
              Lido esistente
            </button>
          </div>

          {modalita === "nuovo" ? (
            <>
              <div>
                <Label htmlFor="nome-stabilimento">Nome stabilimento</Label>
                <Input
                  id="nome-stabilimento"
                  required
                  value={nomeStabilimento}
                  onChange={(e) => setNomeStabilimento(e.target.value)}
                  className="mt-1.5"
                  placeholder="Lido Azzurro"
                />
              </div>
              <div>
                <Label htmlFor="numero-ombrelloni">Numero ombrelloni</Label>
                <Input
                  id="numero-ombrelloni"
                  type="number"
                  min={0}
                  value={numeroOmbrelloni}
                  onChange={(e) => setNumeroOmbrelloni(e.target.value)}
                  className="mt-1.5"
                  placeholder="0"
                />
              </div>
            </>
          ) : (
            <div>
              <Label htmlFor="lido-esistente">Lido</Label>
              <select
                id="lido-esistente"
                value={lidoEsistenteId}
                onChange={(e) => setLidoEsistenteId(e.target.value)}
                className="mt-1.5 w-full h-9 px-3 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-ring transition"
              >
                <option value="">{lidiLoading ? "Caricamento…" : "Seleziona un lido"}</option>
                {lidi.map((l) => (
                  <option key={l.id} value={l.id}>{l.nome}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <Label htmlFor="email-gestore">Email utente da invitare</Label>
            <Input
              id="email-gestore"
              type="email"
              required
              value={emailGestore}
              onChange={(e) => setEmailGestore(e.target.value)}
              className="mt-1.5"
              placeholder="utente@esempio.it"
            />
          </div>

          <div>
            <Label htmlFor="ruolo">Ruolo da assegnare</Label>
            <select
              id="ruolo"
              value={ruolo}
              onChange={(e) => setRuolo(e.target.value as Ruolo)}
              className="mt-1.5 w-full h-9 px-3 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-ring transition"
            >
              <option value="gestore">Gestore</option>
              <option value="staff">Staff</option>
            </select>
          </div>

          {formError && (
            <p className="text-sm font-medium text-destructive bg-destructive/10 rounded-lg py-2.5 px-3">
              {formError}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg py-3 font-semibold brand-gradient text-white shadow-[var(--shadow-card)] hover:opacity-95 transition disabled:opacity-60"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {modalita === "esistente" ? "Invia invito" : "Crea cliente e invia invito"}
          </button>
        </form>
      )}
    </div>
  );
}
