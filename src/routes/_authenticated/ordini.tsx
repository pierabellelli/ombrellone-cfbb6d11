import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useDroppable,
  useDraggable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { Search, ChevronLeft, ChevronRight, Clock, Radio, LayoutGrid, Rows3 } from "lucide-react";

type Stato = "arrivati" | "da_evadere" | "consegnati";

type Item = {
  id: string;
  nome_snapshot: string;
  prezzo_snapshot: number;
  quantita: number;
};

type Ordine = {
  id: string;
  numero_ordine: number;
  numero_ombrellone: string;
  cognome: string;
  totale: number;
  stato: Stato | "annullato";
  created_at: string;
  ordine_items: Item[];
};

export const Route = createFileRoute("/_authenticated/ordini")({
  head: () => ({ meta: [{ title: "Ordini · LidoSmart" }] }),
  component: OrdiniPage,
});

const COLONNE: { id: Stato; titolo: string; tint: string }[] = [
  { id: "arrivati", titolo: "Arrivati", tint: "bg-[color:var(--teal)]/15 border-[color:var(--teal-deep)]/30" },
  { id: "da_evadere", titolo: "Da evadere", tint: "bg-amber-100/60 border-amber-300/60" },
  { id: "consegnati", titolo: "Consegnati", tint: "bg-emerald-100/50 border-emerald-300/50" },
];

const NEXT: Record<Stato, Stato | null> = {
  arrivati: "da_evadere",
  da_evadere: "consegnati",
  consegnati: null,
};
const PREV: Record<Stato, Stato | null> = {
  arrivati: null,
  da_evadere: "arrivati",
  consegnati: "da_evadere",
};

async function loadOrdini(scope: "coda" | "storico"): Promise<Ordine[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let q = supabase
    .from("ordini")
    .select("id, numero_ordine, numero_ombrellone, cognome, totale, stato, created_at, ordine_items(id, nome_snapshot, prezzo_snapshot, quantita)")
    .order("created_at", { ascending: false });
  if (scope === "coda") {
    q = q.gte("created_at", today.toISOString()).neq("stato", "annullato");
  } else {
    q = q.limit(200);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as Ordine[];
}

function OrdiniPage() {
  const queryClient = useQueryClient();
  const [scope, setScope] = useState<"coda" | "storico">("coda");
  const [density, setDensity] = useState<"compatta" | "comoda">("comoda");
  const [search, setSearch] = useState("");

  const { data: ordini = [], isLoading } = useQuery({
    queryKey: ["ordini", scope],
    queryFn: () => loadOrdini(scope),
  });

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("ordini-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "ordini" }, () => {
        queryClient.invalidateQueries({ queryKey: ["ordini"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return ordini;
    return ordini.filter(
      (o) =>
        o.numero_ombrellone.toLowerCase().includes(t) ||
        o.cognome.toLowerCase().includes(t) ||
        String(o.numero_ordine).includes(t),
    );
  }, [ordini, search]);

  const oggi = ordini.filter((o) => {
    const d = new Date(o.created_at); const t = new Date(); t.setHours(0,0,0,0);
    return d >= t && o.stato !== "annullato";
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const moveOrdine = async (id: string, nuovoStato: Stato) => {
    const { error } = await supabase.from("ordini").update({ stato: nuovoStato }).eq("id", id);
    if (error) { toast.error("Impossibile aggiornare", { description: error.message }); return; }
    queryClient.invalidateQueries({ queryKey: ["ordini"] });
  };

  const onDragEnd = (e: DragEndEvent) => {
    const id = String(e.active.id);
    const over = e.over?.id ? String(e.over.id) : null;
    if (!over) return;
    if (COLONNE.some((c) => c.id === over)) moveOrdine(id, over as Stato);
  };

  const dateLabel = new Date().toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-primary">Ordini</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Coda operativa in tempo reale e storico completo degli ordini del lido.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-full border border-border bg-card p-1">
            <button
              onClick={() => setScope("coda")}
              className={`px-4 py-1.5 text-sm font-medium rounded-full transition ${scope === "coda" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >Coda</button>
            <button
              onClick={() => setScope("storico")}
              className={`px-4 py-1.5 text-sm font-medium rounded-full transition ${scope === "storico" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >Storico</button>
          </div>
          <div className="text-sm text-muted-foreground inline-flex items-center gap-1.5">
            <Clock className="w-4 h-4" /> {dateLabel}
          </div>
        </div>
      </div>

      <div className="mt-6 card-soft p-4 md:p-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[color:var(--teal-deep)]">
              <Radio className="w-4 h-4 animate-pulse" /> {scope === "coda" ? "Coda attiva · LIVE" : "Storico"}
            </span>
            <span className="text-sm text-muted-foreground">
              {oggi.length} ordini di oggi {scope === "coda" ? "da gestire" : ""}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
              <button
                onClick={() => setDensity("compatta")}
                className={`px-2.5 py-1 text-xs rounded-md inline-flex items-center gap-1 ${density === "compatta" ? "bg-secondary" : ""}`}
              ><Rows3 className="w-3.5 h-3.5" /> Compatta</button>
              <button
                onClick={() => setDensity("comoda")}
                className={`px-2.5 py-1 text-xs rounded-md inline-flex items-center gap-1 ${density === "comoda" ? "bg-secondary" : ""}`}
              ><LayoutGrid className="w-3.5 h-3.5" /> Comoda</button>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Ombrellone, cognome o #numero"
                className="pl-9 pr-3 py-2 rounded-lg border border-input bg-card text-sm w-72 focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6">
        {isLoading ? (
          <div className="text-center text-muted-foreground py-20">Caricamento...</div>
        ) : (
          <DndContext sensors={sensors} onDragEnd={onDragEnd}>
            <div className="grid md:grid-cols-3 gap-4">
              {COLONNE.map((col) => {
                const cards = filtered.filter((o) => o.stato === col.id);
                return (
                  <Colonna key={col.id} col={col} count={cards.length}>
                    {cards.length === 0 ? (
                      <div className="text-xs text-muted-foreground py-8 text-center">
                        Nessun ordine
                      </div>
                    ) : (
                      cards.map((o) => (
                        <CardOrdine
                          key={o.id}
                          ordine={o}
                          density={density}
                          onMove={moveOrdine}
                        />
                      ))
                    )}
                  </Colonna>
                );
              })}
            </div>
          </DndContext>
        )}
      </div>
    </div>
  );
}

function Colonna({
  col, count, children,
}: { col: { id: Stato; titolo: string; tint: string }; count: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });
  return (
    <div
      ref={setNodeRef}
      className={`rounded-2xl border ${col.tint} p-3 min-h-[300px] transition ${isOver ? "ring-2 ring-[color:var(--teal-deep)]" : ""}`}
    >
      <div className="flex items-center justify-between px-1 py-2">
        <h3 className="font-semibold text-primary">{col.titolo}</h3>
        <span className="text-xs font-bold bg-white/70 px-2 py-0.5 rounded-full">{count}</span>
      </div>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

function CardOrdine({
  ordine, density, onMove,
}: { ordine: Ordine; density: "compatta" | "comoda"; onMove: (id: string, s: Stato) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: ordine.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  const stato = ordine.stato as Stato;
  const next = NEXT[stato];
  const prev = PREV[stato];
  const ora = new Date(ordine.created_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white rounded-xl border border-border p-3 shadow-sm hover:shadow-md transition cursor-grab active:cursor-grabbing ${isDragging ? "opacity-50" : ""}`}
      {...listeners}
      {...attributes}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="inline-flex items-center gap-1.5">
            <span className="text-xs font-bold text-[color:var(--teal-deep)]">#{String(ordine.numero_ordine).padStart(3, "0")}</span>
            <span className="text-xs text-muted-foreground">{ora}</span>
          </div>
          <div className="mt-1 font-semibold text-primary leading-tight">
            🏖️ Omb. {ordine.numero_ombrellone} · {ordine.cognome}
          </div>
        </div>
        <div className="text-right font-bold text-primary">
          {Number(ordine.totale).toFixed(2)} €
        </div>
      </div>

      {density === "comoda" && (
        <ul className="mt-2.5 space-y-0.5 text-xs text-foreground/80">
          {ordine.ordine_items?.map((it) => (
            <li key={it.id} className="flex justify-between gap-2">
              <span className="truncate">{it.quantita}× {it.nome_snapshot}</span>
              <span className="text-muted-foreground shrink-0">
                {(it.prezzo_snapshot * it.quantita).toFixed(2)} €
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          disabled={!prev}
          onClick={(e) => { e.stopPropagation(); if (prev) onMove(ordine.id, prev); }}
          onPointerDown={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-border bg-card hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Indietro
        </button>
        <button
          disabled={!next}
          onClick={(e) => { e.stopPropagation(); if (next) onMove(ordine.id, next); }}
          onPointerDown={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md brand-gradient text-white disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Avanza <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
