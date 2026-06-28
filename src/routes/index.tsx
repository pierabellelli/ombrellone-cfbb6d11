import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  TrendingUp,
  Timer,
  Smile,
  Smartphone,
  Check,
  X,
  AlertCircle,
  CheckCircle2,
  QrCode,
  UtensilsCrossed,
  Bell,
  Package,
  ChevronRight,
  Users,
  PiggyBank,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "OmbrellOne — Niente più code al bar." },
      { name: "description", content: "I tuoi clienti ordinano dal lettino in 30 secondi. Tu incassi di più, il tuo personale lavora meglio." },
      { property: "og:title", content: "OmbrellOne — Niente più code al bar." },
      { property: "og:description", content: "I tuoi clienti ordinano dal lettino in 30 secondi. Tu incassi di più, il tuo personale lavora meglio." },
    ],
  }),
  component: Home,
});

const BENEFICI = [
  { emoji: "📈", titolo: "Più ordini per ombrellone", descrizione: "Il cliente ordina quando vuole, senza aspettare il cameriere", Icon: TrendingUp },
  { emoji: "⏱️", titolo: "Personale più efficiente", descrizione: "Meno corse, meno errori, più tempo per servire", Icon: Timer },
  { emoji: "😌", titolo: "Zero code al bar", descrizione: "Esperienza cliente superiore, clienti che tornano", Icon: Smile },
  { emoji: "📲", titolo: "Attivo in 24 ore", descrizione: "Nessuna installazione hardware, setup immediato", Icon: Smartphone },
];

const CONFRONTO = [
  { tradizionale: "Il cliente va al bar", ombrellone: "Ordina dal lettino" },
  { tradizionale: "Code e attese", ombrellone: "Ordine immediato" },
  { tradizionale: "Il cameriere prende nota", ombrellone: "Ordine digitale, zero errori" },
  { tradizionale: "Nessun dato sugli ordini", ombrellone: "Dashboard in tempo reale" },
];

const COME_FUNZIONA = [
  {
    Icon: QrCode,
    titolo: "Scansiona il QR",
    descrizione: "Il cliente inquadra il codice al suo ombrellone",
  },
  {
    Icon: UtensilsCrossed,
    titolo: "Sceglie dal menu",
    descrizione: "Vede il menu digitale, ordina in 30 secondi",
  },
  {
    Icon: Bell,
    titolo: "Il bar riceve",
    descrizione: "L'ordine arriva direttamente alla cassa",
  },
  {
    Icon: Package,
    titolo: "Consegna al lettino",
    descrizione: "Nessuna coda, nessun errore",
  },
];

const ROI = [
  {
    Icon: TrendingUp,
    titolo: "Più ordini",
    descrizione: "Il cliente ordina quando vuole. Nessun momento di attesa = più consumi.",
  },
  {
    Icon: Users,
    titolo: "Personale più efficiente",
    descrizione: "Meno corse, meno errori. Il tuo staff serve meglio con meno fatica.",
  },
  {
    Icon: PiggyBank,
    titolo: "Meno sprechi",
    descrizione: "Ordini digitali, zero malintesi. Meno resi, meno problemi.",
  },
];

function DemoButton({ className }: { className?: string }) {
  return (
    <a
      href="#contatto"
      className={`inline-flex items-center justify-center rounded-full px-8 py-4 font-semibold transition shadow-[var(--shadow-elevated)] ${className}`}
    >
      Richiedi una demo gratuita
    </a>
  );
}

type FormStatus = "idle" | "submitting" | "success" | "error";

function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <Hero />
      <Benefici />
      <ComeFunziona />
      <EmotionSection />
      <PrimaDopo />
      <RoiSection />
      <Confronto />
      <Urgenza />
      <FormContatto />
      <CtaFinale />
      <Footer />
    </div>
  );
}

function NavBar() {
  return (
    <header className="px-6 py-5 flex items-center justify-between">
      <img src="/logo_ombrellOne.png" alt="OmbrellOne" className="h-24 w-auto" />
      <Link
        to="/login"
        className="text-sm font-medium px-4 py-2 rounded-full border border-border bg-card hover:bg-secondary transition"
      >
        Accedi
      </Link>
    </header>
  );
}

function Hero() {
  return (
    <section className="grid lg:grid-cols-2 gap-12 px-6 lg:px-16 py-12 max-w-7xl mx-auto w-full items-center">
      <div>
        <span className="chip chip-active mb-6">🏖️ Pensato per i lidi italiani</span>
        <h1 className="text-5xl md:text-6xl font-extrabold leading-[1.05] text-primary">
          Niente più code al bar.
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-md">
          I tuoi clienti ordinano dal lettino in 30 secondi. Tu incassi di più, il tuo personale lavora meglio.
        </p>
        <div className="mt-8">
          <a
            href="#contatto"
            className="bg-primary text-primary-foreground inline-flex items-center justify-center rounded-full px-6 py-3 font-semibold shadow-[var(--shadow-elevated)] hover:bg-primary/90 transition"
          >
            Richiedi una demo gratuita
          </a>
        </div>
      </div>

      <div className="relative">
        <img
          src="/main_ombrellone_gestionale_bar.png"
          alt="OmbrellOne in uso al lido"
          className="rounded-2xl shadow-xl w-full object-cover"
        />
      </div>
    </section>
  );
}

function Benefici() {
  return (
    <section className="px-6 lg:px-16 py-16 max-w-7xl mx-auto w-full">
      <h2 className="text-3xl md:text-4xl font-bold text-primary text-center mb-12">
        I vantaggi per il tuo stabilimento
      </h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {BENEFICI.map((b) => (
          <div
            key={b.titolo}
            className="bg-white rounded-2xl border border-border shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition p-6 text-center"
          >
            <div className="text-5xl mb-4">{b.emoji}</div>
            <h3 className="text-lg font-bold text-primary">{b.titolo}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{b.descrizione}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function EmotionSection() {
  return (
    <section className="px-6 lg:px-16 py-20 max-w-4xl mx-auto w-full text-center">
      <p className="text-3xl md:text-4xl font-bold text-primary leading-tight">
        Sole. Spritz. Panino.<br />
        <span className="text-[color:var(--teal-deep)]">Ordinato dal lettino, arrivato senza alzarsi.</span>
      </p>
      <p className="mt-6 text-lg text-muted-foreground">
        Questo è ciò che i tuoi clienti ricordano — e per cui tornano.
      </p>
    </section>
  );
}

function ComeFunziona() {
  return (
    <section className="px-6 lg:px-16 py-20 max-w-6xl mx-auto w-full">
      <h2 className="text-3xl md:text-4xl font-bold text-primary text-center mb-12">
        Come funziona
      </h2>
      <div className="flex flex-col lg:flex-row items-stretch gap-4 lg:gap-6">
        {COME_FUNZIONA.map((step, index) => (
          <div key={step.titolo} className="flex-1 flex items-center gap-4 lg:gap-6">
            <div className="flex-1 bg-white rounded-2xl border border-border shadow-[var(--shadow-card)] p-6 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <step.Icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-primary">{step.titolo}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{step.descrizione}</p>
            </div>
            {index < COME_FUNZIONA.length - 1 && (
              <div className="flex items-center justify-center text-[color:var(--teal-deep)]">
                <ChevronRight className="w-6 h-6 hidden lg:block" />
                <ChevronRight className="w-6 h-6 lg:hidden rotate-90" />
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-12 text-center">
        <DemoButton className="bg-primary text-primary-foreground hover:bg-primary/90" />
      </div>
    </section>
  );
}

function PrimaDopo() {
  const prima = ["Code al bar", "Cameriere di corsa", "Ordini sbagliati", "Nessun dato"];
  const dopo = ["Ordini dal lettino", "Personale libero", "Zero errori", "Dashboard in tempo reale"];
  return (
    <section className="px-6 lg:px-16 py-20 max-w-6xl mx-auto w-full">
      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-2xl border-2 border-destructive/20 bg-destructive/5 p-8">
          <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <AlertCircle className="w-7 h-7 text-destructive" />
          </div>
          <h3 className="text-2xl font-bold text-destructive mb-6">Prima di OmbrellOne</h3>
          <ul className="space-y-3">
            {prima.map((item) => (
              <li key={item} className="flex items-center gap-3 text-base text-foreground/80">
                <X className="w-5 h-5 text-destructive shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border-2 border-[color:var(--teal-deep)]/30 bg-[color:var(--teal-deep)]/10 p-8">
          <div className="w-14 h-14 rounded-full bg-[color:var(--teal-deep)]/10 flex items-center justify-center mb-4">
            <CheckCircle2 className="w-7 h-7 text-[color:var(--teal-deep)]" />
          </div>
          <h3 className="text-2xl font-bold text-[color:var(--teal-deep)] mb-6">Con OmbrellOne</h3>
          <ul className="space-y-3">
            {dopo.map((item) => (
              <li key={item} className="flex items-center gap-3 text-base font-medium text-foreground">
                <Check className="w-5 h-5 text-[color:var(--teal-deep)] shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function RoiSection() {
  return (
    <section className="px-6 lg:px-16 py-20 max-w-6xl mx-auto w-full">
      <h2 className="text-3xl md:text-4xl font-bold text-primary text-center mb-12">
        Il tuo ritorno economico
      </h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {ROI.map((card) => (
          <div
            key={card.titolo}
            className="bg-white rounded-2xl border border-border shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition p-6"
          >
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <card.Icon className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-bold text-primary">{card.titolo}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{card.descrizione}</p>
          </div>
        ))}
      </div>
      <div className="mt-12 text-center">
        <DemoButton className="bg-primary text-primary-foreground hover:bg-primary/90" />
      </div>
    </section>
  );
}

function Confronto() {
  return (
    <section className="px-6 lg:px-16 py-20 max-w-4xl mx-auto w-full">
      <h2 className="text-3xl md:text-4xl font-bold text-primary text-center">
        Perché i gestori scelgono OmbrellOne
      </h2>
      <div className="mt-12 card-soft overflow-hidden">
        <div className="grid grid-cols-2">
          <div className="bg-muted/50 p-4 md:p-6 text-center font-semibold text-sm md:text-base text-muted-foreground border-b border-border">
            Metodo tradizionale
          </div>
          <div className="bg-primary p-4 md:p-6 text-center font-semibold text-sm md:text-base text-primary-foreground border-b border-border">
            OmbrellOne
          </div>
          {CONFRONTO.map((row, i) => (
            <div key={i} className="contents">
              <div className="p-4 md:p-6 border-b border-border last:border-b-0 flex items-start gap-2 md:gap-3 text-sm md:text-base">
                <X className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                <span className="text-muted-foreground">{row.tradizionale}</span>
              </div>
              <div className="p-4 md:p-6 border-b border-border last:border-b-0 flex items-start gap-2 md:gap-3 text-sm md:text-base bg-[color:var(--teal-deep)]/5">
                <Check className="w-5 h-5 text-[color:var(--teal-deep)] shrink-0 mt-0.5" />
                <span className="font-medium text-foreground">{row.ombrellone}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Urgenza() {
  return (
    <section className="px-6 lg:px-16 py-20 max-w-4xl mx-auto w-full text-center">
      <div className="card-soft p-8 md:p-12 bg-primary text-primary-foreground">
        <p className="text-2xl md:text-3xl font-bold leading-tight">
          La stagione è già iniziata.
        </p>
        <p className="mt-3 text-lg md:text-xl text-primary-foreground/90">
          Ogni settimana senza OmbrellOne è una settimana di ordini persi.
        </p>
        <a
          href="#contatto"
          className="mt-8 inline-flex items-center justify-center rounded-full px-8 py-4 font-semibold bg-[color:var(--teal-deep)] text-white hover:opacity-90 transition shadow-lg"
        >
          Prenota la tua demo — è gratuita
        </a>
      </div>
    </section>
  );
}

function CtaFinale() {
  return (
    <section className="px-6 lg:px-16 py-20 max-w-3xl mx-auto w-full text-center">
      <h2 className="text-3xl md:text-4xl font-bold text-primary">
        Pronto a digitalizzare il tuo stabilimento?
      </h2>
      <p className="mt-4 text-lg text-muted-foreground">
        Setup in 24 ore. Nessun hardware. Annullabile quando vuoi.
      </p>
      <a
        href="#contatto"
        className="mt-8 inline-flex items-center justify-center rounded-full px-8 py-4 font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-[var(--shadow-elevated)]"
      >
        Richiedi una demo gratuita
      </a>
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

    const { error } = await (supabase.from("contatti" as any) as any).insert({
      nome: nome.trim(),
      email: email.trim(),
      nome_lido: nomeLido.trim(),
      citta: citta.trim(),
      messaggio: messaggio.trim() ? messaggio.trim() : null,
    } as any);

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
          <Input id="contatto-nome" required value={nome} onChange={(e) => setNome(e.target.value)} className="mt-1.5" placeholder="Mario Rossi" />
        </div>
        <div>
          <Label htmlFor="contatto-email">Email</Label>
          <Input id="contatto-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5" placeholder="email@miolido.it" />
        </div>
        <div>
          <Label htmlFor="contatto-lido">Nome del lido</Label>
          <Input id="contatto-lido" required value={nomeLido} onChange={(e) => setNomeLido(e.target.value)} className="mt-1.5" placeholder="Lido Azzurro" />
        </div>
        <div>
          <Label htmlFor="contatto-citta">Città</Label>
          <Input id="contatto-citta" required value={citta} onChange={(e) => setCitta(e.target.value)} className="mt-1.5" placeholder="Capaccio Paestum" />
        </div>
        <div>
          <Label htmlFor="contatto-messaggio">Messaggio</Label>
          <Textarea id="contatto-messaggio" value={messaggio} onChange={(e) => setMessaggio(e.target.value)} className="mt-1.5" rows={4} placeholder="Raccontaci qualcosa in più sul tuo lido (opzionale)" />
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
        <span className="text-sm text-white/80">© {new Date().getFullYear()} OmbrellOne</span>
        <Link to="/login" className="text-sm font-medium text-white hover:underline">
          Accedi al gestionale
        </Link>
      </div>
    </footer>
  );
}
