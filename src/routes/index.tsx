import { createFileRoute, Link } from "@tanstack/react-router";
import beachHero from "@/assets/beach-hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LidoSmart — Ordina dal tuo ombrellone" },
      { name: "description", content: "LidoSmart: ordini dal bar via QR per lidi e stabilimenti balneari italiani. Coda ordini in tempo reale per lo staff." },
      { property: "og:title", content: "LidoSmart" },
      { property: "og:description", content: "Ordini dal bar via QR per stabilimenti balneari." },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LogoMark />
          <span className="font-display font-bold text-lg text-primary">LidoSmart</span>
        </div>
        <Link
          to="/login"
          className="text-sm font-medium px-4 py-2 rounded-full border border-border bg-card hover:bg-secondary transition"
        >
          Area staff
        </Link>
      </header>

      <main className="flex-1 grid lg:grid-cols-2 gap-12 px-6 lg:px-16 py-12 max-w-7xl mx-auto w-full items-center">
        <div>
          <span className="chip chip-active mb-6">Nuovo · Servizio bar via QR</span>
          <h1 className="text-5xl md:text-6xl font-extrabold leading-[1.05] text-primary">
            Ordini dal tuo<br />
            <span className="text-[color:var(--teal-deep)]">ombrellone.</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-md">
            LidoSmart porta il menu del bar direttamente sul telefono dei clienti.
            Niente file, niente attese: lo staff vede ogni ordine in tempo reale.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/login"
              className="brand-gradient inline-flex items-center justify-center rounded-full px-6 py-3 font-semibold shadow-[var(--shadow-elevated)] hover:opacity-95 transition"
            >
              Accedi alla dashboard
            </Link>
            <Link
              to="/lido/$slug"
              params={{ slug: "demo" }}
              search={{ o: "12" } as any}
              className="inline-flex items-center justify-center rounded-full px-6 py-3 font-semibold border border-border bg-card hover:bg-secondary transition"
            >
              Vedi area cliente demo
            </Link>
          </div>
          <div className="mt-4 text-sm">
            <Link
              to="/traccia/$slug"
              params={{ slug: "demo" }}
              className="text-[color:var(--teal-deep)] font-medium hover:underline"
            >
              Traccia ordine demo →
            </Link>
            <a href="#come-funziona" className="ml-4 text-muted-foreground hover:underline">
              Come funziona
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

      <section id="come-funziona" className="px-6 lg:px-16 pb-20 max-w-7xl mx-auto w-full">
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { n: "01", t: "Cliente scansiona il QR", d: "Sull'ombrellone trova il codice. Si apre il menu del bar." },
            { n: "02", t: "Aggiunge prodotti", d: "Sceglie cosa ordinare, indica ombrellone e cognome." },
            { n: "03", t: "Staff lo prepara", d: "L'ordine arriva subito nella coda Kanban dello staff." },
          ].map((s) => (
            <div key={s.n} className="card-soft p-6">
              <div className="text-sm font-bold text-[color:var(--teal-deep)]">{s.n}</div>
              <h3 className="mt-2 text-lg font-semibold">{s.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="px-6 py-6 text-center text-xs text-muted-foreground border-t border-border">
        © {new Date().getFullYear()} LidoSmart — Sistema di ordinazione QR per stabilimenti balneari
      </footer>
    </div>
  );
}

function LogoMark() {
  return (
    <div className="w-9 h-9 rounded-xl brand-gradient flex items-center justify-center shadow-[var(--shadow-card)]">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v3" />
        <path d="M3 12h18" />
        <path d="M12 2a10 10 0 0 1 10 10H2A10 10 0 0 1 12 2z" fill="currentColor" stroke="none" opacity="0.9" />
        <path d="M12 12v8" />
        <path d="M9 22h6" />
      </svg>
    </div>
  );
}
