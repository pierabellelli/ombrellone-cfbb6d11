import { Link } from "@tanstack/react-router";
import { useState } from "react";

type Lang = "it" | "en";

const content: Record<Lang, { title: string; updated: string; sections: { heading: string; body: string[] }[] }> = {
  it: {
    title: "Termini di Servizio",
    updated: "Ultimo aggiornamento: giugno 2025 · Versione 1.0",
    sections: [
      {
        heading: "1. Definizioni",
        body: [
          "Piattaforma: il servizio software OmbrellOne, accessibile tramite il sito ombrellone.app e le relative applicazioni.",
          "Fornitore: Bellelli Digital (attività individuale / sole trader), fornitore della Piattaforma.",
          "Operatore: il titolare o gestore di un lido che si registra sulla Piattaforma.",
          "Cliente finale: l'ospite del lido che effettua ordini tramite la Piattaforma.",
        ],
      },
      {
        heading: "2. Oggetto del servizio",
        body: [
          "OmbrellOne è un servizio SaaS (Software as a Service) per la gestione di ordini tramite QR code, menu digitali e ombrelloni.",
          "OmbrellOne non è parte della transazione commerciale tra Operatore e Cliente finale: il servizio si limita a fornire lo strumento tecnologico per la gestione degli ordini.",
        ],
      },
      {
        heading: "3. Registrazione e account",
        body: [
          "L'account dell'Operatore è personale e non cedibile a terzi.",
          "L'Operatore è tenuto a notificare immediatamente al Fornitore, scrivendo a ciao@ombrellone.app, qualsiasi uso non autorizzato del proprio account.",
        ],
      },
      {
        heading: "4. Obblighi dell'Operatore",
        body: [
          "L'Operatore si impegna a utilizzare la Piattaforma in modo lecito, a mantenere riservate le proprie credenziali di accesso e a garantire la conformità al GDPR per quanto riguarda il trattamento dei dati dei Clienti finali raccolti tramite la Piattaforma.",
        ],
      },
      {
        heading: "5. Pagamenti",
        body: [
          "Le tariffe del servizio sono definite nella relativa offerta commerciale sottoscritta dall'Operatore.",
          "Eventuali modifiche alle tariffe saranno comunicate con un preavviso di almeno 30 giorni.",
          "I pagamenti relativi agli ordini avvengono direttamente tra il Cliente finale e l'Operatore: OmbrellOne non gestisce né intermedia alcuna transazione economica.",
        ],
      },
      {
        heading: "6. Disponibilità del servizio",
        body: [
          "Il Fornitore si impegna a garantire la disponibilità della Piattaforma con il massimo impegno (best effort), senza tuttavia garantire un uptime del 100%.",
          "Il Fornitore non è responsabile per interruzioni del servizio dovute a causa di forza maggiore.",
        ],
      },
      {
        heading: "7. Proprietà intellettuale",
        body: ["Tutti i diritti di proprietà intellettuale relativi alla Piattaforma, inclusi software, marchi e contenuti, sono di esclusiva titolarità del Fornitore."],
      },
      {
        heading: "8. Limitazione di responsabilità",
        body: [
          "Il Fornitore non è responsabile per danni indiretti, incidentali o consequenziali derivanti dall'uso della Piattaforma.",
          "La responsabilità complessiva del Fornitore è in ogni caso limitata all'importo corrispondente all'ultimo mese di servizio pagato dall'Operatore.",
        ],
      },
      {
        heading: "9. Durata e risoluzione",
        body: [
          "Ciascuna delle parti può recedere dal contratto con un preavviso scritto di 30 giorni.",
          "Il Fornitore si riserva il diritto di risolvere immediatamente il contratto in caso di violazione dei presenti Termini da parte dell'Operatore.",
        ],
      },
      {
        heading: "10. Legge applicabile e foro competente",
        body: ["I presenti Termini sono regolati dalla legge italiana. Per qualsiasi controversia è competente in via esclusiva il Foro di Salerno."],
      },
      {
        heading: "11. Contatti",
        body: ["Per qualsiasi domanda relativa ai presenti Termini di Servizio, è possibile scrivere a ciao@ombrellone.app."],
      },
    ],
  },
  en: {
    title: "Terms of Service",
    updated: "Last updated: June 2025 · Version 1.0",
    sections: [
      {
        heading: "1. Definitions",
        body: [
          "Platform: the OmbrellOne software service, accessible via ombrellone.app and related applications.",
          "Provider: Bellelli Digital (sole trader), the provider of the Platform.",
          "Operator: the owner or manager of a beach club who registers on the Platform.",
          "End Customer: the beach club guest who places orders through the Platform.",
        ],
      },
      {
        heading: "2. Purpose of the service",
        body: [
          "OmbrellOne is a SaaS (Software as a Service) for managing QR-code orders, digital menus and sunbeds.",
          "OmbrellOne is not a party to the commercial transaction between the Operator and the End Customer: the service merely provides the technology tool for order management.",
        ],
      },
      {
        heading: "3. Registration and account",
        body: [
          "The Operator's account is personal and may not be transferred to third parties.",
          "The Operator must immediately notify the Provider, by writing to ciao@ombrellone.app, of any unauthorized use of their account.",
        ],
      },
      {
        heading: "4. Operator obligations",
        body: [
          "The Operator agrees to use the Platform lawfully, to keep their access credentials confidential, and to ensure GDPR compliance regarding the processing of End Customer data collected through the Platform.",
        ],
      },
      {
        heading: "5. Payments",
        body: [
          "Service fees are defined in the relevant commercial offer signed by the Operator.",
          "Any changes to fees will be communicated with at least 30 days' notice.",
          "Payments relating to orders take place directly between the End Customer and the Operator: OmbrellOne does not manage or intermediate any financial transaction.",
        ],
      },
      {
        heading: "6. Service availability",
        body: [
          "The Provider undertakes to ensure the availability of the Platform on a best-effort basis, without guaranteeing 100% uptime.",
          "The Provider is not liable for service interruptions due to force majeure.",
        ],
      },
      {
        heading: "7. Intellectual property",
        body: ["All intellectual property rights related to the Platform, including software, trademarks and content, are exclusively owned by the Provider."],
      },
      {
        heading: "8. Limitation of liability",
        body: [
          "The Provider is not liable for indirect, incidental or consequential damages arising from use of the Platform.",
          "The Provider's overall liability is in any case limited to the amount corresponding to the last month of service paid by the Operator.",
        ],
      },
      {
        heading: "9. Term and termination",
        body: [
          "Either party may terminate the contract with 30 days' written notice.",
          "The Provider reserves the right to immediately terminate the contract in the event of a breach of these Terms by the Operator.",
        ],
      },
      {
        heading: "10. Governing law and jurisdiction",
        body: ["These Terms are governed by Italian law. Any dispute shall be subject to the exclusive jurisdiction of the Court of Salerno."],
      },
      {
        heading: "11. Contact",
        body: ["For any questions regarding these Terms of Service, please write to ciao@ombrellone.app."],
      },
    ],
  },
};

export default function TermsOfServicePage() {
  const [lang, setLang] = useState<Lang>("it");
  const data = content[lang];

  return (
    <div className="min-h-screen bg-[#F8FAFF] text-[#1A1A2E]">
      <header className="border-b border-black/5 bg-white">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between gap-4">
          <Link to="/" className="text-sm font-medium text-[#0057B8] hover:underline">
            ← OmbrellOne
          </Link>
          <button
            type="button"
            onClick={() => setLang(lang === "it" ? "en" : "it")}
            className="text-sm font-medium px-3 py-1.5 rounded-full border border-[#0057B8]/20 hover:bg-[#FFD600]/20 transition-colors"
            aria-label="Cambia lingua / Switch language"
          >
            {lang === "it" ? "🇮🇹 IT" : "🇬🇧 EN"}
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 sm:py-14">
        <h1 className="text-2xl sm:text-3xl font-bold text-[#0057B8] mb-2">{data.title}</h1>
        <p className="text-sm text-[#1A1A2E]/60 mb-10">{data.updated}</p>

        <div className="space-y-8">
          {data.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-lg font-semibold mb-2">{section.heading}</h2>
              <div className="space-y-2">
                {section.body.map((paragraph, i) => (
                  <p key={i} className="text-sm sm:text-base leading-relaxed text-[#1A1A2E]/85">
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
