import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, CheckCircle2, ChefHat, PackageCheck, Clock } from "lucide-react";

export const Route = createFileRoute("/traccia/$slug")({
  head: () => ({ meta: [{ title: "Traccia ordine · LidoSmart" }] }),
  component: TracciaPage,
});

type Stato = "arrivati" | "da_evadere" | "consegnati" | "annullato";

type Ordine = {
  id: string;
  numero_ordine: number;
  numero_ombrellone: string;
  cognome: string;
  totale: number;
  stato: Stato;
  created_at: string;
};

const STEPS: { key: Stato; label: string; icon: typeof Clock }[] = [
  { key: "arrivati", label: "Ricevuto", icon: Clock },
  { key: "da_evadere", label: "In preparazione", icon: ChefHat },
  { key: "consegnati", label: "Consegnato", icon: PackageCheck },
];

function TracciaPage() {
  const { slug } = Route.useParams();
  const [numero, setNumero] = useState("");
  const [cognome, setCognome] = useState("");
  const [query, setQuery] = useState<{ numero: number; cognome: string } | null>(null);

  const { data, isFetching, error } = useQuery({
    queryKey: ["traccia", slug, query?.numero, query?.cognome],
    enabled: !!query,
    refetchInterval: 5000,
    queryFn: async (): Promise<Ordine | null> => {
      const { data, error } = await supabase.rpc("traccia_ordine", {
        _slug: slug,
        _numero: query!.numero,
        _cognome: query!.cognome,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return (row as Ordine) ?? null;
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseInt(numero, 10);
    if (!n || !cognome.trim()) return;
    setQuery({ numero: n, cognome: cognome.trim() });
  };

  const stato = data?.stato;
  const activeIdx = stato ? STEPS.findIndex((s) => s.key === stato) : -1;

  return (
    <div className="min-h-screen bg-[color:var(--bg-soft)] py-10 px-4">
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-primary">Traccia il tuo ordine</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Inserisci numero ordine e cognome per vedere lo stato in tempo reale.
          </p>
        </div>

        <form onSubmit={submit} className="card-soft p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">N° ordine</label>
              <input
                inputMode="numeric"
                value={numero}
                onChange={(e) => setNumero(e.target.value.replace(/\D/g, ""))}
                placeholder="es. 12"
                className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Cognome</label>
              <input
                value={cognome}
                onChange={(e) => setCognome(e.target.value)}
                placeholder="es. Rossi"
                className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
            </div>
          </div>
          <button
            type="submit"
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg brand-gradient text-white font-semibold"
          >
            <Search className="w-4 h-4" /> Cerca ordine
          </button>
        </form>

        {query && (
          <div className="card-soft p-5 mt-5">
            {isFetching && !data ? (
              <div className="text-center text-muted-foreground py-8">Ricerca in corso…</div>
            ) : error ? (
              <div className="text-center text-destructive py-8">Errore: {(error as Error).message}</div>
            ) : !data ? (
              <div className="text-center py-8">
                <p className="text-foreground font-medium">Nessun ordine trovato</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Verifica numero e cognome. Si possono tracciare solo gli ordini di oggi.
                </p>
              </div>
            ) : data.stato === "annullato" ? (
              <div className="text-center py-8">
                <p className="text-destructive font-semibold">Ordine annullato</p>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground">Ordine</div>
                    <div className="text-2xl font-bold text-primary">
                      #{String(data.numero_ordine).padStart(3, "0")}
                    </div>
                    <div className="text-sm text-foreground mt-1">
                      🏖️ Omb. {data.numero_ombrellone} · {data.cognome}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Totale</div>
                    <div className="text-xl font-bold text-primary">{Number(data.totale).toFixed(2)} €</div>
                  </div>
                </div>

                <div className="mt-6">
                  <div className="flex items-center justify-between">
                    {STEPS.map((s, i) => {
                      const Icon = s.icon;
                      const done = i <= activeIdx;
                      const current = i === activeIdx;
                      return (
                        <div key={s.key} className="flex-1 flex flex-col items-center">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition ${
                              done
                                ? "bg-[color:var(--teal-deep)] border-[color:var(--teal-deep)] text-white"
                                : "bg-card border-border text-muted-foreground"
                            } ${current ? "ring-4 ring-[color:var(--teal)]/30 animate-pulse" : ""}`}
                          >
                            {done && i < activeIdx ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                          </div>
                          <div className={`text-xs mt-2 text-center ${done ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                            {s.label}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="relative mt-[-44px] mx-12 h-0.5 bg-border -z-10">
                    <div
                      className="h-full bg-[color:var(--teal-deep)] transition-all"
                      style={{ width: `${Math.max(0, activeIdx) * 50}%` }}
                    />
                  </div>
                </div>

                <p className="text-xs text-muted-foreground text-center mt-6 inline-flex items-center justify-center gap-1.5 w-full">
                  <span className="w-2 h-2 rounded-full bg-[color:var(--teal-deep)] animate-pulse" />
                  Aggiornamento automatico ogni 5 secondi
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
