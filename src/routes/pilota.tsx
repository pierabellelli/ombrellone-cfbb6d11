import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/pilota")({
  head: () => ({
    meta: [
      { title: "Candida il tuo lido — Programma Pilota · OmbrellOne" },
      {
        name: "description",
        content: "Candida il tuo stabilimento al Programma Pilota OmbrellOne: 1 mese gratuito, setup in 48 ore, solo 3 posti disponibili.",
      },
    ],
  }),
  component: PilotaPage,
});

type FormStatus = "idle" | "submitting" | "success" | "error";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function PilotaPage() {
  const [nome, setNome] = useState("");
  const [cognome, setCognome] = useState("");
  const [nomeLido, setNomeLido] = useState("");
  const [localita, setLocalita] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [numeroOmbrelloni, setNumeroOmbrelloni] = useState("");
  const [barAttivo, setBarAttivo] = useState(true);
  const [note, setNote] = useState("");
  // Honeypot: campo nascosto, invisibile agli utenti reali. Se un bot lo
  // compila, scartiamo silenziosamente la candidatura senza fare insert.
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<FormStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (website.trim()) {
      // Bot: comportati come se fosse andato tutto bene, ma non inviare nulla.
      setStatus("success");
      return;
    }

    const ombrelloni = Number(numeroOmbrelloni);
    if (!nome.trim() || !cognome.trim() || !nomeLido.trim() || !localita.trim() || !telefono.trim()) {
      setErrorMsg("Compila tutti i campi obbligatori.");
      setStatus("error");
      return;
    }
    if (!isValidEmail(email.trim())) {
      setErrorMsg("Inserisci un'email valida.");
      setStatus("error");
      return;
    }
    if (!Number.isFinite(ombrelloni) || ombrelloni <= 0) {
      setErrorMsg("Inserisci un numero di ombrelloni valido.");
      setStatus("error");
      return;
    }

    setStatus("submitting");
    setErrorMsg(null);

    const { error } = await (supabase.from("pilot_leads" as any) as any).insert({
      nome: nome.trim(),
      cognome: cognome.trim(),
      nome_lido: nomeLido.trim(),
      localita: localita.trim(),
      telefono: telefono.trim(),
      email: email.trim(),
      numero_ombrelloni: ombrelloni,
      bar_attivo: barAttivo,
      note: note.trim() ? note.trim() : null,
    } as any);

    if (error) {
      setErrorMsg("Errore nell'invio. Riprova.");
      setStatus("error");
      return;
    }

    setStatus("success");
    setNome("");
    setCognome("");
    setNomeLido("");
    setLocalita("");
    setTelefono("");
    setEmail("");
    setNumeroOmbrelloni("");
    setBarAttivo(true);
    setNote("");
  };

  return (
    <div className="min-h-screen bg-[color:var(--sky-tint)] px-6 py-10 flex flex-col items-center">
      <div className="w-full max-w-lg">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition">
          <ArrowLeft className="w-4 h-4" />
          Torna alla home
        </Link>

        <div className="mt-6 text-center">
          <span className="chip chip-active w-fit mx-auto mb-4">PROGRAMMA PILOTA — ESTATE 2026</span>
          <h1 className="text-3xl md:text-4xl font-bold text-primary">Candida il tuo lido</h1>
          <p className="mt-3 text-muted-foreground">
            Ti ricontattiamo entro 24 ore.
          </p>
        </div>

        {status === "success" ? (
          <div className="mt-8 card-soft p-6 md:p-8 text-center">
            <CheckCircle2 className="w-10 h-10 text-[color:var(--teal-deep)] mx-auto mb-3" />
            <p className="text-lg font-semibold text-primary">Candidatura ricevuta!</p>
            <p className="mt-2 text-muted-foreground">Ti ricontattiamo entro 24 ore. Nessuna carta di credito richiesta.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 card-soft p-6 md:p-8 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="pilota-nome">Nome</Label>
                <Input id="pilota-nome" required value={nome} onChange={(e) => setNome(e.target.value)} className="mt-1.5" placeholder="Mario" />
              </div>
              <div>
                <Label htmlFor="pilota-cognome">Cognome</Label>
                <Input id="pilota-cognome" required value={cognome} onChange={(e) => setCognome(e.target.value)} className="mt-1.5" placeholder="Rossi" />
              </div>
            </div>
            <div>
              <Label htmlFor="pilota-lido">Nome del lido</Label>
              <Input id="pilota-lido" required value={nomeLido} onChange={(e) => setNomeLido(e.target.value)} className="mt-1.5" placeholder="Lido Azzurro" />
            </div>
            <div>
              <Label htmlFor="pilota-localita">Località</Label>
              <Input id="pilota-localita" required value={localita} onChange={(e) => setLocalita(e.target.value)} className="mt-1.5" placeholder="Capaccio Paestum" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="pilota-telefono">Telefono</Label>
                <Input id="pilota-telefono" type="tel" required value={telefono} onChange={(e) => setTelefono(e.target.value)} className="mt-1.5" placeholder="333 1234567" />
              </div>
              <div>
                <Label htmlFor="pilota-email">Email</Label>
                <Input id="pilota-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5" placeholder="email@miolido.it" />
              </div>
            </div>
            <div>
              <Label htmlFor="pilota-ombrelloni">Numero di ombrelloni</Label>
              <Input
                id="pilota-ombrelloni"
                type="number"
                min={1}
                required
                value={numeroOmbrelloni}
                onChange={(e) => setNumeroOmbrelloni(e.target.value)}
                className="mt-1.5"
                placeholder="60"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="pilota-bar" checked={barAttivo} onCheckedChange={(v) => setBarAttivo(v === true)} />
              <Label htmlFor="pilota-bar" className="font-normal">Il lido ha un bar attivo</Label>
            </div>
            <div>
              <Label htmlFor="pilota-note">Note (opzionale)</Label>
              <Textarea id="pilota-note" value={note} onChange={(e) => setNote(e.target.value)} className="mt-1.5" rows={3} placeholder="Raccontaci qualcosa in più sul tuo lido" />
            </div>

            {/* Honeypot anti-spam: nascosto via CSS, non tabIndex/aria per non aiutare gli screen reader a saltarlo agli occhi dei bot */}
            <div className="absolute -left-[9999px] w-px h-px overflow-hidden" aria-hidden="true">
              <Label htmlFor="pilota-website">Sito web</Label>
              <Input id="pilota-website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </div>

            <Button type="submit" disabled={status === "submitting"} className="w-full h-11 rounded-full">
              {status === "submitting" ? "Invio in corso…" : "Candida il tuo lido"}
            </Button>

            {status === "error" && errorMsg && (
              <p className="text-sm font-medium text-center text-destructive bg-destructive/10 rounded-lg py-2.5">
                {errorMsg}
              </p>
            )}

            <p className="text-xs text-muted-foreground text-center">
              Ti ricontattiamo entro 24 ore. Nessuna carta di credito richiesta.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
