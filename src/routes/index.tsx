import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Check,
  X,
  QrCode,
  ShoppingCart,
  BellRing,
  ChevronRight,
  Menu,
  Kanban,
  Map,
  BarChart3,
  ShieldCheck,
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
  { titolo: "Kanban in tempo reale", descrizione: "Ogni ordine arriva subito allo staff con notifica sonora. Nessun ordine perso, nessuna confusione.", Icon: Kanban },
  { titolo: "Mappa ombrelloni", descrizione: "Sai sempre cosa sta succedendo in spiaggia. Vedi in un colpo d'occhio dove c'è un ordine in attesa o in ritardo.", Icon: Map },
  { titolo: "Report e analytics", descrizione: "Scopri quali prodotti vendono di più, le ore di punta e il tempo medio di consegna. Dati reali per decisioni migliori.", Icon: BarChart3 },
  { titolo: "Accesso per ruoli", descrizione: "Il gestore controlla tutto. Lo staff vede solo quello che gli serve. Zero confusione, zero errori.", Icon: ShieldCheck },
];

const PRIMA_DOPO = [
  { prima: "🚶 Code al bar", dopo: "📱 Ordini dal lettino" },
  { prima: "📝 Cameriere prende nota", dopo: "✅ Ordine digitale preciso" },
  { prima: "❌ Errori di trascrizione", dopo: "🔔 Notifica immediata allo staff" },
  { prima: "⏳ Clienti aspettano", dopo: "⚡ Flusso organizzato" },
  { prima: "😰 Personale sotto pressione", dopo: "😊 Staff efficiente e sereno" },
];

const COME_FUNZIONA = [
  {
    Icon: QrCode,
    titolo: "Scansiona",
    descrizione: "Il cliente inquadra il QR sull'ombrellone",
  },
  {
    Icon: ShoppingCart,
    titolo: "Ordina",
    descrizione: "Sceglie dal menu e invia in un tap",
  },
  {
    Icon: BellRing,
    titolo: "Ricevi",
    descrizione: "L'ordine arriva subito allo staff, senza errori",
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
      <ComeFunziona />
      <PrimaDopo />
      <Benefici />
      <InAzione />
      <EmotionSection />
      <Urgenza />
      <FormContatto />
      <CtaFinale />
      <Footer />
    </div>
  );
}

const NAV_LINKS = [
  { href: "#come-funziona", label: "Come funziona", pill: false },
  { href: "#contatto", label: "Richiedi demo", pill: true },
  { href: "#contatto", label: "Contatti", pill: false },
];

function NavBar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`sticky top-0 z-50 bg-white transition-shadow ${scrolled ? "shadow-sm" : ""}`}>
      <div className="px-6 py-2 flex items-center justify-between max-w-7xl mx-auto w-full">
        <img src="/logo_ombrellOne.png" alt="OmbrellOne" className="h-24 w-auto" />

        <nav className="hidden md:flex items-center gap-6">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className={
                link.pill
                  ? "text-sm font-semibold px-4 py-2 rounded-full bg-[color:var(--teal-deep)] text-white hover:opacity-90 transition"
                  : "text-sm font-medium text-foreground hover:text-primary transition"
              }
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:block">
          <Link
            to="/login"
            className="text-sm font-medium px-4 py-2 rounded-full border border-border bg-card hover:bg-secondary transition"
          >
            Accedi
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="md:hidden p-2 rounded-lg hover:bg-secondary transition"
          aria-label="Apri il menu"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-white px-6 py-4 flex flex-col gap-3">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className={
                link.pill
                  ? "text-sm font-semibold text-center px-4 py-2 rounded-full bg-[color:var(--teal-deep)] text-white"
                  : "text-sm font-medium text-foreground py-1.5"
              }
            >
              {link.label}
            </a>
          ))}
          <Link
            to="/login"
            onClick={() => setMobileOpen(false)}
            className="text-sm font-medium text-center px-4 py-2 rounded-full border border-border bg-card"
          >
            Accedi
          </Link>
        </div>
      )}
    </header>
  );
}

function Hero() {
  return (
    <section className="flex flex-col lg:flex-row min-h-screen overflow-hidden">
      <div className="w-full h-64 lg:h-full lg:w-1/2 lg:order-2 flex p-0 m-0 gap-0 overflow-hidden rounded-none">
        <img
          src="/main_ombrellone_gestionale_bar2.png"
          alt="OmbrellOne in uso al lido"
          className="w-full h-full object-cover object-center rounded-none"
        />
      </div>

      <div className="w-full lg:w-1/2 lg:order-1 flex flex-col justify-center bg-white px-6 lg:px-16 py-12">
        <span className="chip chip-active w-fit mb-6">🏖️ Pensato per i lidi italiani</span>
        <h1 className="text-5xl md:text-6xl font-extrabold leading-[1.05] text-primary">
          Il sistema operativo<br />
          del tuo <span className="text-[color:var(--teal-deep)]">stabilimento.</span>
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-md">
          Ordini digitali, mappa in tempo reale, analytics e menu dal QR. OmbrellOne gestisce l'operatività del tuo bar mentre tu ti concentri sui clienti.
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
    </section>
  );
}

function Benefici() {
  return (
    <section id="funzionalita" className="px-6 lg:px-16 py-16 max-w-7xl mx-auto w-full">
      <h2 className="text-3xl md:text-4xl font-bold text-primary text-center">
        Tutto quello che ti serve
      </h2>
      <p className="mt-4 text-lg text-muted-foreground text-center max-w-2xl mx-auto">
        Non un'altra app per i lidi. Un sistema completo che gestisce ordini, consegne, mappa, menu digitale e analytics — tutto in un posto solo.
      </p>
      <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {BENEFICI.map((b) => (
          <div
            key={b.titolo}
            className="bg-white rounded-2xl border border-border shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition p-6 text-center"
          >
            <b.Icon className="w-8 h-8 text-teal-600 mx-auto mb-4" />
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
    <section id="come-funziona" className="px-6 lg:px-16 py-20 max-w-6xl mx-auto w-full">
      <h2 className="text-3xl md:text-4xl font-bold text-primary text-center mb-12">
        Come funziona
      </h2>
      <div className="flex flex-col lg:flex-row items-stretch gap-4 lg:gap-6">
        {COME_FUNZIONA.map((step, index) => (
          <div key={step.titolo} className="flex-1 flex items-center gap-4 lg:gap-6">
            <div className="flex-1 text-center">
              <step.Icon className="w-16 h-16 text-teal-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-primary">{step.titolo}</h3>
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

const IN_AZIONE_ITEMS = [
  {
    badge: "👤 Esperienza cliente",
    titolo: "Il cliente ordina in 30 secondi",
    testo: "Scansiona il QR, sceglie dal menu, invia. Nessuna app da installare, nessuna registrazione. I preferiti vengono ricordati per il prossimo ordine.",
    image: "/screenshot-menu.jpeg",
    imageClassName: "rounded-2xl shadow-xl w-full max-w-[280px] mx-auto",
    reverse: false,
  },
  {
    badge: "👨‍💼 Gestionale staff",
    titolo: "Lo staff gestisce tutto in tempo reale",
    testo: "Ogni ordine appare istantaneamente nel Kanban con notifica sonora. Nuovi → In preparazione → Consegnato. Nessun ordine perso, nessuna confusione.",
    image: "/screenshot-kanban-desktop.png",
    imageClassName: "rounded-2xl shadow-xl w-full",
    reverse: true,
  },
  {
    badge: "🗺️ Mappa ombrelloni",
    titolo: "Controllo visivo di ogni ombrellone",
    testo: "Vedi in un colpo d'occhio quali ombrelloni hanno ordini attivi, in ritardo o consegnati. Clicca su un ombrellone per vedere i dettagli.",
    image: "/screenshot-mappa.jpg.jpeg",
    imageClassName: "rounded-2xl shadow-xl w-full max-w-[280px] mx-auto",
    reverse: false,
  },
];

const IN_AZIONE_GRID = [
  {
    badge: "📱 Mobile first",
    titolo: "Lavora da qualsiasi dispositivo",
    testo: "Il gestionale è ottimizzato per tablet e smartphone. Lo staff può lavorare senza PC.",
    image: "/screenshot-kanban-mobile.jpeg",
    imageClassName: "rounded-2xl shadow-xl w-full max-w-[220px] mx-auto",
  },
  {
    badge: "📊 Analytics",
    titolo: "Analizza le performance del tuo lido",
    testo: "Prodotti più venduti, ore di punta, revenue e tempo medio di consegna. Dati per decidere meglio.",
    image: "/screenshot-report.png",
    imageClassName: "rounded-2xl shadow-xl w-full",
  },
];

function InAzione() {
  return (
    <section className="px-6 lg:px-16 py-20 max-w-6xl mx-auto w-full">
      <h2 className="text-3xl md:text-4xl font-bold text-primary text-center">
        Vedi OmbrellOne in azione
      </h2>
      <p className="mt-4 text-lg text-muted-foreground text-center max-w-2xl mx-auto">
        Dal menu sul telefono del cliente al report serale del gestore.
      </p>

      <div className="mt-16 space-y-16">
        {IN_AZIONE_ITEMS.map((item) => (
          <div
            key={item.titolo}
            className={`grid md:grid-cols-2 gap-8 md:gap-12 items-center ${item.reverse ? "md:[&>*:first-child]:order-2" : ""}`}
          >
            <div>
              <span className="chip chip-active">{item.badge}</span>
              <h3 className="mt-4 text-2xl md:text-3xl font-bold text-primary">{item.titolo}</h3>
              <p className="mt-3 text-muted-foreground">{item.testo}</p>
            </div>
            <div>
              <img src={item.image} alt={item.titolo} className={item.imageClassName} />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-16 grid md:grid-cols-2 gap-8">
        {IN_AZIONE_GRID.map((item) => (
          <div key={item.titolo} className="bg-white rounded-2xl border border-border shadow-[var(--shadow-card)] p-6 md:p-8">
            <span className="chip chip-active">{item.badge}</span>
            <h3 className="mt-4 text-xl font-bold text-primary">{item.titolo}</h3>
            <p className="mt-3 text-muted-foreground">{item.testo}</p>
            <img src={item.image} alt={item.titolo} className={`mt-6 ${item.imageClassName}`} />
          </div>
        ))}
      </div>
    </section>
  );
}

function PrimaDopo() {
  return (
    <section className="px-6 lg:px-16 py-20 max-w-3xl mx-auto w-full">
      <h2 className="text-3xl md:text-4xl font-bold text-primary text-center">
        Il tuo lido, prima e dopo
      </h2>
      <p className="mt-4 text-lg text-muted-foreground text-center">
        La differenza la vedi dal primo giorno.
      </p>
      <div className="mt-12 bg-white rounded-2xl shadow-sm border border-border overflow-hidden">
        <div className="grid grid-cols-2">
          <div className="p-4 md:p-5 text-center font-semibold text-destructive border-b border-border">Prima</div>
          <div className="p-4 md:p-5 text-center font-semibold text-[color:var(--teal-deep)] border-b border-border">Dopo</div>
          {PRIMA_DOPO.map((row, i) => (
            <div key={i} className="contents">
              <div
                className={`p-4 md:p-5 flex items-center gap-2 text-sm md:text-base text-destructive/80 border-b border-border last:border-b-0 ${
                  i % 2 === 1 ? "bg-destructive/5" : ""
                }`}
              >
                <X className="w-4 h-4 text-destructive shrink-0" />
                <span>{row.prima}</span>
              </div>
              <div
                className={`p-4 md:p-5 flex items-center gap-2 text-sm md:text-base font-medium text-[color:var(--teal-deep)] border-b border-border last:border-b-0 ${
                  i % 2 === 1 ? "bg-[color:var(--teal-deep)]/5" : ""
                }`}
              >
                <Check className="w-4 h-4 text-[color:var(--teal-deep)] shrink-0" />
                <span>{row.dopo}</span>
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
      <p className="text-sm text-muted-foreground mt-1">
        Oppure scrivici direttamente a{" "}
        <a href="mailto:ciao@ombrellone.app"
           className="text-teal-600 hover:underline font-medium">
          ciao@ombrellone.app
        </a>
      </p>
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
