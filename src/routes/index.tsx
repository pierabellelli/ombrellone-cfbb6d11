import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import beachHero from "@/assets/beach-hero.jpg";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { QrCode, ShoppingCart, BellRing, Kanban, Map, BarChart3, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "OmbrellOne — Ordini QR per stabilimenti balneari" },
      { name: "description", content: "OmbrellOne porta il menu del bar direttamente sul telefono dei clienti. Sistema di ordinazione QR per lidi e stabilimenti balneari italiani." },
      { property: "og:title", content: "OmbrellOne" },
      { property: "og:description", content: "Ordini dal bar via QR per stabilimenti balneari italiani." },
    ],
  }),
  component: Home,
});

const COME_FUNZIONA_STEPS = [
  {
    Icon: QrCode,
    numero: "01",
    titolo: "QR code sull'ombrellone",
    descrizione: "Il cliente scansiona il QR e vede il menu del tuo bar direttamente sul telefono. Nessuna app da installare.",
  },
  {
    Icon: ShoppingCart,
    numero: "02",
    titolo: "Ordine in un tap",
    descrizione: "Il cliente sceglie i prodotti e invia l'ordine. Può tracciare lo stato in tempo reale.",
  },
  {
    Icon: BellRing,
    numero: "03",
    titolo: "Staff avvisato istantaneamente",
    descrizione: "L'ordine appare subito nel Kanban dello staff con notifica sonora. Niente confusione, niente errori.",
  },
];

const FUNZIONALITA = [
  {
    Icon: Kanban,
    titolo: "Kanban in tempo reale",
    descrizione: "Ogni ordine scorre tra le colonne: Nuovo → In preparazione → Consegnato. Lo staff non perde nulla.",
  },
  {
    Icon: Map,
    titolo: "Mappa ombrelloni",
    descrizione: "Visualizza lo stato di ogni ombrellone in tempo reale. Vedi subito dove c'è un ordine in ritardo.",
  },
  {
    Icon: BarChart3,
    titolo: "Report e analytics",
    descrizione: "Prodotti più venduti, ore di punta, revenue giornaliera e tempo medio di consegna. Dati per decidere meglio.",
  },
  {
    Icon: ShieldCheck,
    titolo: "Accesso per ruoli",
    descrizione: "Il gestore ha accesso completo. Lo staff vede solo mappa e ordini. Nessuna sovrapposizione.",
  },
];

const PER_CHI = ["🏖️ Stabilimenti balneari", "🌊 Lidi attrezzati", "☀️ Beach club"];

type FormStatus = "idle" | "submitting" | "success" | "error";

function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />

      <main className="flex-1 grid lg:grid-cols-2 gap-12 px-6 lg:px-16 py-12 max-w-7xl mx-auto w-full items-center">
        <div>
          <span className="chip chip-active mb-6">🏖️ Pensato per i lidi italiani</span>
          <h1 className="text-5xl md:text-6xl font-extrabold leading-[1.05] text-primary">
            Ordini dal tuo<br />
            <span className="text-[color:var(--teal-deep)]">ombrellone.</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-md">
            Il tuo bar prende ordini mentre tu gestisci il lido.
            I clienti ordinano dal telefono, lo staff consegna. Zero code, zero errori.
          </p>
          <div className="mt-8">
            <a
              href="#contatto"
              className="bg-primary text-primary-foreground inline-flex items-center justify-center rounded-full px-6 py-3 font-semibold shadow-[var(--shadow-elevated)] hover:bg-primary/90 transition"
            >
              Richiedi una demo
            </a>
          </div>
        </div>

        <div className="relative">
          <img
            src={beachHero}
            alt="Vista aerea di un lido italiano con ombrelloni"
            width={1536}
            height={1024}
            className="rounded-3xl shadow-[var(--shadow-elevated)] aspect-[4/3] object-cover"
          />
        </div>
      </main>

      <ComeFunziona />
      <Funzionalita />
      <PerChiE />
      <FormContatto />
      <Footer />
    </div>
  );
}

function NavBar() {
  return (
    <header className="px-6 py-5 flex items-center justify-between">
      <img src="/logo_ombrellOne.png" alt="OmbrellOne" className="h-14 w-auto" />
      <Link
        to="/login"
        className="text-sm font-medium px-4 py-2 rounded-full border border-border bg-card hover:bg-secondary transition"
      >
        Accedi
      </Link>
    </header>
  );
}

function ComeFunziona() {
  return (
    <section className="px-6 lg:px-16 py-20 max-w-7xl mx-auto w-full">
      <h2 className="text-3xl md:text-4xl font-bold text-primary text-center">Come funziona</h2>
      <div className="mt-12 grid md:grid-cols-3 gap-6">
        {COME_FUNZIONA_STEPS.map((s) => (
          <div key={s.numero} className="card-soft p-6">
            <div className="flex items-center justify-between">
              <s.Icon className="w-8 h-8 text-teal-600" />
              <span className="text-sm font-bold text-[color:var(--teal-deep)]">{s.numero}</span>
            </div>
            <h3 className="mt-4 text-lg font-semibold">{s.titolo}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{s.descrizione}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Funzionalita() {
  return (
    <section className="px-6 lg:px-16 py-20 max-w-7xl mx-auto w-full">
      <h2 className="text-3xl md:text-4xl font-bold text-primary text-center">Tutto quello che ti serve</h2>
      <div className="mt-12 grid sm:grid-cols-2 gap-6">
        {FUNZIONALITA.map((f) => (
          <div key={f.titolo} className="card-soft p-6">
            <f.Icon className="w-8 h-8 text-teal-600" />
            <h3 className="mt-4 text-lg font-semibold">{f.titolo}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{f.descrizione}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function PerChiE() {
  return (
    <section className="px-6 lg:px-16 py-20 max-w-7xl mx-auto w-full text-center">
      <h2 className="text-3xl md:text-4xl font-bold text-primary">Fatto per i lidi italiani</h2>
      <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
        OmbrellOne è pensato per stabilimenti balneari, lidi attrezzati e beach club che vogliono
        digitalizzare il servizio bar senza complicazioni.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        {PER_CHI.map((p) => (
          <span key={p} className="chip text-sm">{p}</span>
        ))}
      </div>
    </section>
  );
}

function FormContatto() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [nomeLido, setNomeLido] = useState("");
  const [citta, setCitta] = useState("");
  const [messaggio, setMessaggio] = useState("");
  const [status, setStatus] = useState<FormStatus>("idle");

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus("submitting");

    const { error } = await supabase.from("contatti").insert({
      nome: nome.trim(),
      email: email.trim(),
      nome_lido: nomeLido.trim(),
      citta: citta.trim(),
      messaggio: messaggio.trim() ? messaggio.trim() : null,
    });

    if (error) {
      setStatus("error");
      return;
    }

    setStatus("success");
    setNome("");
    setEmail("");
    setNomeLido("");
    setCitta("");
    setMessaggio("");
  };

  return (
    <section id="contatto" className="px-6 lg:px-16 py-20 max-w-2xl mx-auto w-full">
      <h2 className="text-3xl md:text-4xl font-bold text-primary text-center">Richiedi una demo gratuita</h2>
      <p className="mt-4 text-lg text-muted-foreground text-center">
        Compila il form e ti contatteremo entro 24 ore.
      </p>

      <form onSubmit={handleSubmit} className="mt-10 card-soft p-6 md:p-8 space-y-4">
        <div>
          <Label htmlFor="contatto-nome">Nome e cognome</Label>
          <Input
            id="contatto-nome"
            required
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="mt-1.5"
            placeholder="Mario Rossi"
          />
        </div>
        <div>
          <Label htmlFor="contatto-email">Email</Label>
          <Input
            id="contatto-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1.5"
            placeholder="mario@example.com"
          />
        </div>
        <div>
          <Label htmlFor="contatto-lido">Nome del lido</Label>
          <Input
            id="contatto-lido"
            required
            value={nomeLido}
            onChange={(e) => setNomeLido(e.target.value)}
            className="mt-1.5"
            placeholder="Bagno Marina"
          />
        </div>
        <div>
          <Label htmlFor="contatto-citta">Città</Label>
          <Input
            id="contatto-citta"
            required
            value={citta}
            onChange={(e) => setCitta(e.target.value)}
            className="mt-1.5"
            placeholder="Rimini"
          />
        </div>
        <div>
          <Label htmlFor="contatto-messaggio">Messaggio</Label>
          <Textarea
            id="contatto-messaggio"
            value={messaggio}
            onChange={(e) => setMessaggio(e.target.value)}
            className="mt-1.5"
            rows={4}
            placeholder="Raccontaci qualcosa in più sul tuo lido (opzionale)"
          />
        </div>

        <Button type="submit" disabled={status === "submitting"} className="w-full h-11 rounded-full">
          {status === "submitting" ? "Invio in corso…" : "Invia richiesta"}
        </Button>

        {status === "success" && (
          <p className="text-sm font-medium text-center text-[color:var(--success-foreground)] bg-[color:var(--success)]/30 rounded-lg py-2.5">
            ✅ Richiesta inviata! Ti contatteremo presto.
          </p>
        )}
        {status === "error" && (
          <p className="text-sm font-medium text-center text-destructive bg-destructive/10 rounded-lg py-2.5">
            Errore nell'invio. Riprova.
          </p>
        )}
      </form>
    </section>
  );
}

function Footer() {
  return (
    <footer className="hero-gradient px-6 py-8">
      <div className="max-w-7xl mx-auto w-full flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <img src="/logo_ombrellOne.png" alt="OmbrellOne" className="h-16 w-auto" />
          <span className="text-sm text-white/80">© {new Date().getFullYear()} OmbrellOne</span>
        </div>
        <Link to="/login" className="text-sm font-medium text-white hover:underline">
          Accedi al gestionale
        </Link>
      </div>
    </footer>
  );
}
