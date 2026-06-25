import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Lang = "it" | "en";

const DICT = {
  it: {
    "nav.orders": "Ordini",
    "nav.products": "Prodotti",
    "nav.settings": "Impostazioni",
    "nav.map": "Mappa ombrelloni",
    "nav.beachConfig": "Configurazione Lido",
    "logout": "Esci",
    // Beach config
    "bc.title": "Configurazione Lido",
    "bc.subtitle": "Definisci la disposizione di file e ombrelloni della tua spiaggia.",
    "bc.rows": "Numero di file",
    "bc.numbering": "Modalità di numerazione",
    "bc.numAutoLR": "Automatica · sinistra → destra (da 1)",
    "bc.numAutoRL": "Automatica · destra → sinistra (da 1)",
    "bc.numManual": "Manuale (inserisco io ogni numero)",
    "bc.rowsDetail": "Dettaglio file",
    "bc.rowLabel": "Etichetta fila",
    "bc.umbrellasInRow": "Ombrelloni in questa fila",
    "bc.manualNumbers": "Numeri ombrelloni",
    "bc.preview": "Anteprima",
    "bc.save": "Salva configurazione",
    "bc.saved": "Configurazione salvata",
    "bc.saveError": "Errore nel salvataggio",
    "bc.row": "Fila",
    "bc.noLido": "Nessun lido associato al tuo account.",
    "bc.onlyManager": "Solo il gestore può configurare il lido.",
    // Map
    "map.title": "Mappa ombrelloni",
    "map.subtitle": "Stato in tempo reale degli ombrelloni e degli ordini attivi.",
    "map.noConfig": "Configurazione spiaggia mancante. Chiedi al gestore di impostare file e ombrelloni.",
    "map.legend": "Legenda",
    "map.legend.free": "Libero",
    "map.legend.active": "Ordine attivo",
    "map.legend.warn": "Ritardo > 10 min",
    "map.legend.late": "Ritardo > 15 min",
    "map.noOrder": "Nessun ordine attivo",
    "map.markDelivered": "Segna come consegnato",
    "map.deliveredOk": "Ordine consegnato",
    "map.updateError": "Aggiornamento non riuscito",
    "map.umbrella": "Ombrellone",
    "map.customer": "Cliente",
    "map.phone": "Telefono",
    "map.payment": "Pagamento",
    "map.payment.cash": "Contanti",
    "map.payment.card": "Carta",
    "map.items": "Articoli",
    "map.total": "Totale",
    "map.status": "Stato",
    "map.elapsed": "Tempo trascorso",
    "map.close": "Chiudi",
    "common.cancel": "Annulla",
  },
  en: {
    "nav.orders": "Orders",
    "nav.products": "Products",
    "nav.settings": "Settings",
    "nav.map": "Umbrella map",
    "nav.beachConfig": "Beach setup",
    "logout": "Sign out",
    "bc.title": "Beach Configuration",
    "bc.subtitle": "Define the rows and umbrellas layout of your beach.",
    "bc.rows": "Number of rows",
    "bc.numbering": "Numbering mode",
    "bc.numAutoLR": "Automatic · left → right (from 1)",
    "bc.numAutoRL": "Automatic · right → left (from 1)",
    "bc.numManual": "Manual (I enter each number)",
    "bc.rowsDetail": "Rows detail",
    "bc.rowLabel": "Row label",
    "bc.umbrellasInRow": "Umbrellas in this row",
    "bc.manualNumbers": "Umbrella numbers",
    "bc.preview": "Preview",
    "bc.save": "Save configuration",
    "bc.saved": "Configuration saved",
    "bc.saveError": "Save failed",
    "bc.row": "Row",
    "bc.noLido": "No beach is linked to your account.",
    "bc.onlyManager": "Only the manager can configure the beach.",
    "map.title": "Umbrella map",
    "map.subtitle": "Real-time status of umbrellas and active orders.",
    "map.noConfig": "Beach configuration is missing. Ask the manager to set up rows and umbrellas.",
    "map.legend": "Legend",
    "map.legend.free": "Free",
    "map.legend.active": "Active order",
    "map.legend.warn": "Late > 10 min",
    "map.legend.late": "Late > 15 min",
    "map.noOrder": "No active order",
    "map.markDelivered": "Mark as delivered",
    "map.deliveredOk": "Order delivered",
    "map.updateError": "Update failed",
    "map.umbrella": "Umbrella",
    "map.customer": "Customer",
    "map.phone": "Phone",
    "map.payment": "Payment",
    "map.payment.cash": "Cash",
    "map.payment.card": "Card",
    "map.items": "Items",
    "map.total": "Total",
    "map.status": "Status",
    "map.elapsed": "Elapsed",
    "map.close": "Close",
    "common.cancel": "Cancel",
  },
} as const;

type Key = keyof typeof DICT["it"];

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (k: Key) => string };
const I18nCtx = createContext<Ctx>({ lang: "it", setLang: () => {}, t: (k) => k });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("it");
  useEffect(() => {
    const saved = (typeof window !== "undefined" && (localStorage.getItem("ombrellone.lang") as Lang)) || null;
    if (saved === "it" || saved === "en") setLangState(saved);
  }, []);
  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") localStorage.setItem("ombrellone.lang", l);
  };
  const t = (k: Key) => DICT[lang][k] ?? k;
  return <I18nCtx.Provider value={{ lang, setLang, t }}>{children}</I18nCtx.Provider>;
}

export const useI18n = () => useContext(I18nCtx);
