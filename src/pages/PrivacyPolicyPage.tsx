import { Link } from "@tanstack/react-router";
import { useState } from "react";

type Lang = "it" | "en";

const content: Record<Lang, { title: string; updated: string; sections: { heading: string; body: string[] }[] }> = {
  it: {
    title: "Informativa sulla Privacy",
    updated: "Ultimo aggiornamento: giugno 2025 · Versione 1.0",
    sections: [
      {
        heading: "1. Titolare del trattamento",
        body: [
          "Il Titolare del trattamento dei dati è Bellelli Digital (attività individuale / sole trader), contattabile all'indirizzo email ciao@ombrellone.app.",
        ],
      },
      {
        heading: "2. Ambito di applicazione",
        body: [
          "La presente informativa si applica a due categorie di utenti della piattaforma OmbrellOne:",
          "• Operatori: titolari o gestori di lidi che si registrano sulla piattaforma per gestire ordini, menu e ombrelloni.",
          "• Clienti finali: ospiti dei lidi che effettuano ordini tramite QR code, senza necessità di registrazione.",
        ],
      },
      {
        heading: "3. Dati raccolti e finalità",
        body: [
          "Operatori: raccogliamo nome, cognome, email e password (memorizzata in forma cifrata). Base giuridica: esecuzione di un contratto (art. 6.1.b GDPR).",
          "Clienti finali: raccogliamo nome, cognome e numero di telefono al momento dell'ordine. Base giuridica: esecuzione di un contratto (art. 6.1.b GDPR).",
          "Dati analitici: raccogliamo statistiche anonime e aggregate tramite Cloudflare Web Analytics, che non utilizza cookie e non raccoglie dati personali. Base giuridica: legittimo interesse (art. 6.1.f GDPR).",
          "OmbrellOne non raccoglie né elabora alcun dato di pagamento.",
        ],
      },
      {
        heading: "4. Modalità di trattamento e sicurezza",
        body: [
          "I dati sono trattati con strumenti informatici e adottando misure di sicurezza tecniche e organizzative adeguate, conformemente all'art. 32 del GDPR. Le password sono memorizzate esclusivamente in forma cifrata (hashing) e non sono mai accessibili in chiaro.",
        ],
      },
      {
        heading: "5. Periodo di conservazione",
        body: [
          "Dati degli Operatori: conservati per 24 mesi dalla cessazione del contratto.",
          "Dati degli ordini dei Clienti finali: conservati per 12 mesi dalla data dell'ordine.",
          "Dati analitici aggregati: conservati senza scadenza, in forma anonima e non riconducibile a singoli individui.",
        ],
      },
      {
        heading: "6. Comunicazione a terzi",
        body: [
          "I dati possono essere trattati, in qualità di responsabili del trattamento ex art. 28 GDPR, da Cloudflare Inc. (infrastruttura e analytics) e Supabase Inc. (database e autenticazione).",
          "Qualora tali fornitori trasferiscano dati fuori dall'Unione Europea, il trasferimento avviene sulla base delle Clausole Contrattuali Standard (decisione di esecuzione UE 2021/914).",
        ],
      },
      {
        heading: "7. Cookie",
        body: [
          "OmbrellOne utilizza Cloudflare Web Analytics, un servizio di analisi che non utilizza cookie e non raccoglie dati personali. Per questo motivo non è richiesto alcun consenso ai cookie.",
        ],
      },
      {
        heading: "8. Diritti dell'interessato",
        body: [
          "In qualità di interessato, hai diritto di accesso, rettifica, cancellazione, limitazione del trattamento, portabilità dei dati e opposizione, ai sensi degli artt. 15–22 del GDPR.",
          "Puoi esercitare questi diritti scrivendo a ciao@ombrellone.app. Hai inoltre diritto di presentare un reclamo al Garante per la protezione dei dati personali (garanteprivacy.it).",
        ],
      },
      {
        heading: "9. Responsabile della protezione dei dati",
        body: ["Non è stato nominato alcun Responsabile della Protezione dei Dati (DPO), non essendo obbligatorio per le attività svolte."],
      },
      {
        heading: "10. Modifiche all'informativa",
        body: [
          "La presente informativa può essere aggiornata periodicamente. Eventuali modifiche sostanziali saranno comunicate agli utenti tramite la piattaforma o via email.",
        ],
      },
    ],
  },
  en: {
    title: "Privacy Policy",
    updated: "Last updated: June 2025 · Version 1.0",
    sections: [
      {
        heading: "1. Data Controller",
        body: [
          "The Data Controller is Bellelli Digital (sole trader), reachable at ciao@ombrellone.app.",
        ],
      },
      {
        heading: "2. Scope of application",
        body: [
          "This policy applies to two categories of OmbrellOne users:",
          "• Operators: beach club owners or managers who register on the platform to manage orders, menus and sunbeds.",
          "• End customers: beach club guests who place orders via QR code, without registration.",
        ],
      },
      {
        heading: "3. Data collected and purposes",
        body: [
          "Operators: we collect first name, last name, email and password (stored encrypted). Legal basis: performance of a contract (art. 6.1.b GDPR).",
          "End customers: we collect first name, last name and phone number when placing an order. Legal basis: performance of a contract (art. 6.1.b GDPR).",
          "Analytics data: we collect anonymous, aggregated statistics via Cloudflare Web Analytics, which uses no cookies and collects no personal data. Legal basis: legitimate interest (art. 6.1.f GDPR).",
          "OmbrellOne does not collect or process any payment data.",
        ],
      },
      {
        heading: "4. Processing methods and security",
        body: [
          "Data is processed using IT tools with adequate technical and organizational security measures, in compliance with art. 32 GDPR. Passwords are stored exclusively in encrypted (hashed) form and are never accessible in plain text.",
        ],
      },
      {
        heading: "5. Retention period",
        body: [
          "Operator data: retained for 24 months after contract termination.",
          "End customer order data: retained for 12 months from the order date.",
          "Aggregated analytics data: retained indefinitely, in anonymous form not attributable to individuals.",
        ],
      },
      {
        heading: "6. Disclosure to third parties",
        body: [
          "Data may be processed, as data processors under art. 28 GDPR, by Cloudflare Inc. (infrastructure and analytics) and Supabase Inc. (database and authentication).",
          "Where these providers transfer data outside the European Union, the transfer is based on Standard Contractual Clauses (EU Implementing Decision 2021/914).",
        ],
      },
      {
        heading: "7. Cookies",
        body: [
          "OmbrellOne uses Cloudflare Web Analytics, an analytics service that uses no cookies and collects no personal data. For this reason, no cookie consent is required.",
        ],
      },
      {
        heading: "8. Data subject rights",
        body: [
          "As a data subject, you have the right to access, rectify, erase, restrict processing, port your data, and object, under arts. 15–22 GDPR.",
          "You can exercise these rights by writing to ciao@ombrellone.app. You also have the right to lodge a complaint with the Italian Data Protection Authority (garanteprivacy.it).",
        ],
      },
      {
        heading: "9. Data Protection Officer",
        body: ["No Data Protection Officer (DPO) has been appointed, as it is not mandatory for the activities carried out."],
      },
      {
        heading: "10. Changes to this policy",
        body: [
          "This policy may be updated periodically. Any substantial changes will be communicated to users through the platform or via email.",
        ],
      },
    ],
  },
};

export default function PrivacyPolicyPage() {
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
