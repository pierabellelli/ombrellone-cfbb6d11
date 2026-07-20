import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  QrCode,
  ShoppingCart,
  BellRing,
  ChevronRight,
  Menu,
  Kanban,
  Map,
  BarChart3,
  ShieldCheck,
  Clock,
  Smartphone,
  PenLine,
  CheckCircle2,
  AlertTriangle,
  Hourglass,
  Zap,
  Frown,
  Smile,
  CalendarDays,
  Phone,
  CalendarCheck,
  Wrench,
  Gift,
  Headphones,
  type LucideIcon,
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
  { titolo: "Prenotazioni senza confusione", descrizione: "Controlla disponibilità e prenotazioni senza rincorrere telefonate, messaggi o fogli.", Icon: Kanban },
  { titolo: "Mappa del lido sempre aggiornata", descrizione: "Vedi subito quali ombrelloni sono liberi, prenotati o occupati.", Icon: Map },
  { titolo: "Ordini semplici sotto l'ombrellone", descrizione: "Il cliente ordina dal QR code e lo staff sa subito cosa preparare e dove consegnare.", Icon: BarChart3 },
  { titolo: "Tutto sotto controllo", descrizione: "Uno strumento chiaro e intuitivo per organizzare il lavoro anche nei momenti di punta.", Icon: ShieldCheck },
];

const PRIMA_DOPO: { prima: string; primaIcon: LucideIcon; dopo: string; dopoIcon: LucideIcon }[] = [
  { prima: "Prenotazioni a voce, telefono o WhatsApp", primaIcon: Phone, dopo: "Prenotazioni online in autonomia, sempre tracciate con storico", dopoIcon: CalendarCheck },
  { prima: "Code al bar", primaIcon: Clock, dopo: "Ordini dal lettino", dopoIcon: Smartphone },
  { prima: "Cameriere prende nota", primaIcon: PenLine, dopo: "Ordine digitale preciso", dopoIcon: CheckCircle2 },
  { prima: "Errori di trascrizione", primaIcon: AlertTriangle, dopo: "Notifica immediata allo staff", dopoIcon: BellRing },
  { prima: "Clienti aspettano", primaIcon: Hourglass, dopo: "Flusso organizzato", dopoIcon: Zap },
  { prima: "Personale sotto pressione", primaIcon: Frown, dopo: "Staff efficiente e sereno", dopoIcon: Smile },
];

const COME_FUNZIONA = [
  {
    Icon: CalendarDays,
    titolo: "Prenota",
    descrizione: "Il cliente prenota l'ombrellone online, arriva e trova il posto pronto",
    badge: "Opzionale",
  },
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

const FAQ_ITEMS = [
  {
    domanda: "Cos'è Ombrellone.app?",
    risposta:
      "Una piattaforma che permette ai clienti di ordinare cibo e bevande direttamente dal proprio ombrellone tramite QR code, senza scaricare app o registrarsi.",
  },
  {
    domanda: "Come funziona per il cliente finale?",
    risposta:
      "Scansiona il QR code sul proprio ombrellone, visualizza il menu e ordina in pochi secondi, paga in contanti o con carta. Lo staff riceve l'ordine in tempo reale.",
  },
  {
    domanda: "Come funziona per lo staff?",
    risposta:
      "Dashboard Kanban con tutti gli ordini in arrivo, in lavorazione e completati. Mappa interattiva dello stabilimento con stato ombrelloni in tempo reale. Storico ordini consultabile in qualsiasi momento.",
  },
  {
    domanda: "Quanto tempo serve per attivare il mio stabilimento?",
    risposta: "Pochi giorni: configurazione mappa ombrelloni, menu e accessi staff.",
  },
  {
    domanda: "Serve un hardware particolare?",
    risposta:
      "No. Basta uno smartphone o tablet per lo staff; i clienti usano il proprio telefono per scansionare il QR.",
  },
  {
    domanda: "Quanto costa?",
    risposta: "Pricing personalizzato in base alle esigenze dello stabilimento — contattaci per un preventivo.",
  },
  {
    domanda: "Qual è la durata del contratto?",
    risposta: "Da definire in base alle esigenze dello stabilimento — contattaci per i dettagli.",
  },
  {
    domanda: "I miei dati sono al sicuro?",
    risposta:
      "Sì, la piattaforma è conforme al GDPR; i dati sono gestiti su infrastruttura sicura e non vengono ceduti a terzi.",
  },
  {
    domanda: "Posso gestire più ruoli (gestore, staff)?",
    risposta:
      "Sì: il gestore ha accesso completo, lo staff vede solo le sezioni operative (Mappa, Ordini, Storico).",
  },
  {
    domanda: "È disponibile assistenza dopo l'attivazione?",
    risposta: "Sì, supporto dedicato per onboarding e gestione quotidiana — canali e orari da definire.",
  },
  {
    domanda: "Posso provare la piattaforma prima di attivarla?",
    risposta: "Sì, è possibile richiedere una demo personalizzata.",
  },
  {
    domanda: "Posso gestire le prenotazioni online?",
    risposta:
      "Sì, i clienti possono prenotare l'ombrellone online e lo staff vede subito le prenotazioni sulla mappa del lido, con storico sempre consultabile.",
  },
  {
    domanda: "Il cliente può vedere la disponibilità in tempo reale?",
    risposta:
      "Sì, la disponibilità degli ombrelloni è sempre aggiornata: il cliente vede subito cosa è libero prima di prenotare.",
  },
];

const PILOTA_CARDS = [
  {
    Icon: Wrench,
    titolo: "Setup fatto da noi",
    descrizione: "Configuriamo mappa, menu e QR code. Tu non tocchi niente: in 48 ore sei operativo.",
  },
  {
    Icon: Gift,
    titolo: "1 mese gratuito",
    descrizione: "Nessun costo, nessun vincolo. Se non ti è servito, ci stringiamo la mano.",
  },
  {
    Icon: Headphones,
    titolo: "Supporto diretto del founder",
    descrizione: "Parli con chi ha costruito il prodotto, non con un call center. Modifiche e richieste gestite in 48 ore.",
  },
];

function ProgrammaPilota() {
  return (
    <section id="programma-pilota" className="px-6 lg:px-16 py-20 max-w-5xl mx-auto w-full text-center">
      <span className="chip chip-active w-fit mx-auto">PROGRAMMA PILOTA — ESTATE 2026</span>
      <h2 className="mt-4 text-3xl md:text-4xl font-bold text-primary">
        Stiamo cercando 3 lidi pilota. 1 mese gratuito.
      </h2>
      <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
        Porta gli ordini dal lettino nel tuo stabilimento senza cambiare nulla nel tuo modo di lavorare. Pensiamo a tutto noi: setup completo in 48 ore, menu digitalizzato, QR pronti da mettere sugli ombrelloni.
      </p>

      <div className="mt-12 grid sm:grid-cols-3 gap-6">
        {PILOTA_CARDS.map((c) => (
          <div
            key={c.titolo}
            className="bg-white rounded-2xl border border-border shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition p-6 text-center"
          >
            <c.Icon className="w-8 h-8 text-teal-600 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-primary">{c.titolo}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{c.descrizione}</p>
          </div>
        ))}
      </div>

      <p className="mt-10 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-base md:text-lg font-bold bg-[color:var(--teal-deep)]/10 text-[color:var(--teal-deep)] border border-[color:var(--teal-deep)]/25">
        <Hourglass className="w-5 h-5 shrink-0" />
        Solo 3 posti disponibili. Selezioniamo lidi con bar attivo e almeno 40 ombrelloni.
      </p>

      <Link
        to="/pilota"
        className="mt-6 inline-flex items-center justify-center rounded-full px-8 py-4 font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-[var(--shadow-elevated)]"
      >
        Candida il tuo lido →
      </Link>
      <p className="mt-4 text-sm text-muted-foreground">
        Ti ricontattiamo entro 24 ore. Nessuna carta di credito richiesta.
      </p>
    </section>
  );
}

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
      <ProgrammaPilota />
      <Urgenza />
      <FAQ />
      <FormContatto />
      <CtaFinale />
      <Footer />
    </div>
  );
}

const NAV_LINKS = [
  { href: "#come-funziona", label: "Come funziona", pill: false },
  { href: "#faq", label: "FAQ", pill: false },
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
                  ? "text-base font-semibold px-4 py-2 rounded-full bg-[color:var(--teal-deep)] text-white hover:opacity-90 transition"
                  : "text-base font-medium text-foreground hover:text-primary transition"
              }
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:block">
          <Link
            to="/login"
            className="text-base font-medium px-4 py-2 rounded-full bg-primary text-white hover:opacity-90 transition"
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
                  ? "text-base font-semibold text-center px-4 py-2 rounded-full bg-[color:var(--teal-deep)] text-white"
                  : "text-base font-medium text-foreground py-1.5"
              }
            >
              {link.label}
            </a>
          ))}
          <Link
            to="/login"
            onClick={() => setMobileOpen(false)}
            className="text-base font-medium text-center px-4 py-2 rounded-full bg-primary text-white hover:opacity-90 transition"
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
    <section className="min-h-screen flex flex-col md:flex-row items-center bg-[color:var(--sky-tint)] px-8 md:px-16 lg:px-20 gap-8 md:gap-12">
      <div className="md:hidden w-full rounded-xl overflow-hidden aspect-[4/3]">
        <img
          src="/main_ombrellone_gestionale_bar2.png"
          alt="OmbrellOne in uso al lido"
          className="w-full h-full object-cover object-center"
        />
      </div>

      <div className="w-full md:w-[45%] flex flex-col justify-center">
        <span className="chip chip-active w-fit mb-6">🏖️ Pensato per i lidi italiani</span>
        <h1 className="text-5xl md:text-6xl font-extrabold leading-[1.05] text-primary">
          Meno caos in spiaggia.<br />
          Più organizzazione <span className="text-[color:var(--teal-deep)]">per il tuo lido.</span>
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-md">
          Prenotazioni, disponibilità, mappa degli ombrelloni e ordini sotto la postazione: tutto in un unico posto, semplice da usare per te, il tuo staff e i tuoi clienti.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <a
            href="#contatto"
            className="bg-primary text-primary-foreground inline-flex items-center justify-center rounded-full px-6 py-3 font-semibold shadow-[var(--shadow-elevated)] hover:bg-primary/90 transition"
          >
            Richiedi una demo
          </a>
          <a
            href="#come-funziona"
            className="inline-flex items-center justify-center rounded-full px-6 py-3 font-semibold text-primary hover:text-primary/80 transition"
          >
            Scopri come funziona
          </a>
        </div>
      </div>

      <div className="hidden md:block w-full md:w-[55%] rounded-2xl overflow-hidden shadow-xl aspect-[4/3]">
        <img
          src="/main_ombrellone_gestionale_bar2.png"
          alt="OmbrellOne in uso al lido"
          className="w-full h-full object-cover object-center"
        />
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
        Sole. Spritz. Pizza. Qualsiasi cosa.
      </p>
      <p className="mt-6 text-lg text-muted-foreground">
        I tuoi clienti ordinano dal lettino e mangiano comodamente sotto l'ombrellone — senza occupare un tavolo al bar. Tu servi più persone, ruoti i tavoli più velocemente e incassi di più.
      </p>
      <div className="mt-6 flex flex-row gap-3 justify-center flex-wrap">
        {["Più ordini per turno", "Tavoli sempre disponibili", "Zero code al bar"].map((testo) => (
          <span key={testo} className="bg-primary text-white font-medium text-sm px-5 py-2 rounded-full">
            {testo}
          </span>
        ))}
      </div>
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
              <h3 className="text-xl font-bold text-primary flex items-center justify-center gap-2">
                {step.titolo}
                {step.badge && <span className="chip text-xs font-medium">{step.badge}</span>}
              </h3>
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
    image: "/screenshots/cliente-mobile.png",
    mockup: "phone" as const,
    reverse: false,
  },
  {
    badge: "👨‍💼 Gestionale staff",
    titolo: "Lo staff gestisce tutto in tempo reale",
    testo: "Ogni ordine appare istantaneamente nel Kanban con notifica sonora. Nuovi → In preparazione → Consegnato. Nessun ordine perso, nessuna confusione.",
    image: "/screenshots/kanban.png",
    mockup: "browser" as const,
    reverse: true,
    caption: "📱 Lavora da qualsiasi dispositivo: il gestionale è ottimizzato per tablet e smartphone.",
  },
  {
    badge: "🗺️ Mappa in tempo reale",
    titolo: "Controllo visivo di ogni ombrellone",
    testo: "Vedi in un colpo d'occhio disponibilità, prenotazioni e ordini attivi, in ritardo o consegnati. Clicca su un ombrellone per vedere i dettagli.",
    image: "/screenshots/mappa.png",
    mockup: "browser" as const,
    reverse: false,
  },
  {
    badge: "📊 Performance del lido",
    titolo: "Analizza le performance del tuo lido",
    testo: "Prodotti più venduti, ore di punta, revenue e tempo medio di consegna. Dati per decidere meglio.",
    image: "/screenshots/report.png",
    mockup: "browser" as const,
    reverse: true,
  },
];

function PhoneMockup({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="mx-auto w-full max-w-[260px] rounded-[2.25rem] border-[6px] border-[color:var(--navy-deep)] bg-[color:var(--navy-deep)] shadow-lg">
      <div className="overflow-hidden rounded-[1.75rem]">
        <img src={src} alt={alt} className="w-full h-auto block" />
      </div>
    </div>
  );
}

function BrowserMockup({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="w-full rounded-2xl border border-border shadow-lg overflow-hidden bg-white">
      <div className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 border-b border-border">
        <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
      </div>
      <img src={src} alt={alt} className="w-full h-auto block" />
    </div>
  );
}

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
              {item.mockup === "phone" ? (
                <PhoneMockup src={item.image} alt={item.titolo} />
              ) : (
                <BrowserMockup src={item.image} alt={item.titolo} />
              )}
              {item.caption && (
                <p className="mt-4 text-sm text-muted-foreground text-center italic">{item.caption}</p>
              )}
            </div>
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
          {PRIMA_DOPO.map((row, i) => {
            const PrimaIcon = row.primaIcon;
            const DopoIcon = row.dopoIcon;
            return (
              <div key={i} className="contents">
                <div
                  className={`p-4 md:p-5 flex items-center gap-2 text-sm md:text-base text-destructive/80 border-b border-border last:border-b-0 ${
                    i % 2 === 1 ? "bg-destructive/5" : ""
                  }`}
                >
                  <PrimaIcon className="w-4 h-4 text-destructive shrink-0" />
                  <span>{row.prima}</span>
                </div>
                <div
                  className={`p-4 md:p-5 flex items-center gap-2 text-sm md:text-base font-medium text-[color:var(--teal-deep)] border-b border-border last:border-b-0 ${
                    i % 2 === 1 ? "bg-[color:var(--teal-deep)]/5" : ""
                  }`}
                >
                  <DopoIcon className="w-4 h-4 text-[color:var(--teal-deep)] shrink-0" />
                  <span>{row.dopo}</span>
                </div>
              </div>
            );
          })}
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
          Ogni settimana senza OmbrellOne è una settimana di prenotazioni e ordini persi.
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

function FAQ() {
  return (
    <section id="faq" className="px-6 lg:px-16 py-20 max-w-3xl mx-auto w-full">
      <h2 className="text-3xl md:text-4xl font-bold text-primary text-center">
        Domande frequenti
      </h2>
      <p className="mt-4 text-lg text-muted-foreground text-center">
        Tutto quello che ti serve sapere prima di iniziare.
      </p>

      <Accordion type="single" collapsible className="mt-12 card-soft px-6 md:px-8">
        {FAQ_ITEMS.map((item, index) => (
          <AccordionItem key={item.domanda} value={`item-${index}`}>
            <AccordionTrigger className="text-base md:text-lg text-primary hover:no-underline">
              {item.domanda}
            </AccordionTrigger>
            <AccordionContent className="text-base text-muted-foreground">
              {item.risposta}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
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
      <p className="text-sm text-muted-foreground mt-1 text-center">
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
          <p className="flex items-center justify-center gap-1.5 text-sm font-medium text-center text-[color:var(--success-foreground)] bg-[color:var(--success)]/30 rounded-lg py-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            Richiesta inviata! Ti contatteremo presto.
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
        <div className="flex flex-wrap items-center gap-4">
          <Link to="/privacy" className="text-sm text-white/70 hover:underline">
            Privacy Policy
          </Link>
          <Link to="/terms" className="text-sm text-white/70 hover:underline">
            Termini di Servizio
          </Link>
          <Link to="/login" className="text-sm font-medium text-white hover:underline">
            Accedi al gestionale
          </Link>
        </div>
      </div>
    </footer>
  );
}
