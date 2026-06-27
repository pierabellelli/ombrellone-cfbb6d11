import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Clock, Phone, MapPin, Banknote, CreditCard, StickyNote, ArrowRight, Check, CheckCheck, Archive, Search, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";

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
  fila: string | null;
  cognome: string;
  telefono: string | null;
  metodo_pagamento: string | null;
  note: string | null;
  totale: number;
  stato: Stato | "annullato";
  created_at: string;
  ordine_items: Item[];
};

export const Route = createFileRoute("/_authenticated/ordini")({
  head: () => ({ meta: [{ title: "Ordini · OmbrellOne" }] }),
  component: OrdiniPage,
});

const SELECT_COLS =
  "id, numero_ordine, numero_ombrellone, fila, cognome, telefono, metodo_pagamento, note, totale, stato, created_at, ordine_items(id, nome_snapshot, prezzo_snapshot, quantita)";

function startOfTodayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

async function fetchUserLidoId(): Promise<string | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const { data, error } = await supabase.rpc("user_lido_id");
  if (error) return null;
  return (data as string | null) ?? null;
}

async function loadColonna(stato: Stato, lidoId: string): Promise<Ordine[]> {
  let q = supabase
    .from("ordini")
    .select(SELECT_COLS)
    .eq("lido_id", lidoId)
    .eq("stato", stato)
    .order("created_at", { ascending: stato !== "consegnati" });
  if (stato === "consegnati") q = q.gte("created_at", startOfTodayISO()).eq("archiviato", false);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as Ordine[];
}

function playBeep() {
  if (typeof window === "undefined") return;
  try {
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.36);
    setTimeout(() => ctx.close(), 500);
  } catch { /* ignore */ }
}

function useTick(ms = 1000) {
  const [, set] = useState(0);
  useEffect(() => {
    const id = setInterval(() => set((n) => n + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

function formatElapsed(iso: string) {
  const totalMin = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const STATO_STYLE: Record<Stato, {
  border: string;
  pillBg: string;
  pillIcon: typeof Check;
  pillKey: "kanban.pill.arrivati" | "kanban.pill.daEvadere" | "kanban.pill.consegnati";
  box: string;
}> = {
  arrivati: { border: "border-l-emerald-500", pillBg: "bg-green-100 text-green-800", pillIcon: Check, pillKey: "kanban.pill.arrivati", box: "bg-emerald-50 border-emerald-300 text-emerald-800" },
  da_evadere: { border: "border-l-amber-500", pillBg: "bg-amber-100 text-amber-800", pillIcon: Clock, pillKey: "kanban.pill.daEvadere", box: "bg-amber-50 border-amber-300 text-amber-800" },
  consegnati: { border: "border-l-red-500", pillBg: "bg-emerald-100 text-emerald-800", pillIcon: CheckCheck, pillKey: "kanban.pill.consegnati", box: "bg-red-50 border-red-300 text-red-800" },
};

function OrdiniPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  const { data: lidoId } = useQuery({
    queryKey: ["user-lido-id"],
    queryFn: fetchUserLidoId,
    staleTime: 60_000,
  });

  const enabled = !!lidoId;
  const nuovi = useQuery({
    queryKey: ["ordini-col", "arrivati", lidoId],
    queryFn: () => loadColonna("arrivati", lidoId!),
    enabled,
  });
  const prep = useQuery({
    queryKey: ["ordini-col", "da_evadere", lidoId],
    queryFn: () => loadColonna("da_evadere", lidoId!),
    enabled,
  });
  const consegnati = useQuery({
    queryKey: ["ordini-col", "consegnati", lidoId],
    queryFn: () => loadColonna("consegnati", lidoId!),
    enabled,
  });

  // Beep on new arrivals
  const knownNewIds = useRef<Set<string> | null>(null);
  useEffect(() => {
    const list = nuovi.data ?? [];
    const ids = new Set(list.map((o) => o.id));
    if (knownNewIds.current === null) {
      knownNewIds.current = ids;
      return;
    }
    const hasNew = list.some((o) => !knownNewIds.current!.has(o.id));
    if (hasNew) playBeep();
    knownNewIds.current = ids;
  }, [nuovi.data]);

  // Realtime
  useEffect(() => {
    if (!lidoId) return;
    const channel = supabase
      .channel(`ordini-kanban-${lidoId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ordini", filter: `lido_id=eq.${lidoId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["ordini-col"] });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [lidoId, queryClient]);

  const move = async (id: string, nuovoStato: Stato) => {
    // "Prendi in carico" (arrivati -> da_evadere) also records who/when took
    // the order, atomically and without overwriting if already set.
    const { error } = nuovoStato === "da_evadere"
      ? await supabase.rpc("prendi_in_carico_ordine", { _id: id })
      : await supabase.from("ordini").update({ stato: nuovoStato }).eq("id", id);
    if (error) { toast.error(t("kanban.updateError"), { description: error.message }); return; }
    queryClient.invalidateQueries({ queryKey: ["ordini-col"] });
  };

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const consegnatiIds = useMemo(() => (consegnati.data ?? []).map((o) => o.id), [consegnati.data]);
  const allConsegnatiSelected = consegnatiIds.length > 0 && consegnatiIds.every((id) => selectedIds.has(id));
  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      if (allConsegnatiSelected) return new Set();
      return new Set(consegnatiIds);
    });
  };
  const archiveSelected = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const { error } = await supabase.from("ordini").update({ archiviato: true }).in("id", ids);
    if (error) { toast.error(t("kanban.archiveError"), { description: error.message }); return; }
    toast.success(t("kanban.archiveOk"));
    setSelectedIds(new Set());
    queryClient.invalidateQueries({ queryKey: ["ordini-col"] });
  };

  const columns: { stato: Stato; title: string; headerCls: string }[] = [
    { stato: "arrivati", title: t("kanban.new"), headerCls: "bg-blue-100 text-blue-800 border-blue-200" },
    { stato: "da_evadere", title: t("kanban.preparing"), headerCls: "bg-amber-100 text-amber-900 border-amber-200" },
    { stato: "consegnati", title: t("kanban.delivered"), headerCls: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  ];

  const dataByStato: Record<Stato, Ordine[]> = {
    arrivati: nuovi.data ?? [],
    da_evadere: prep.data ?? [],
    consegnati: consegnati.data ?? [],
  };

  const [filtroNome, setFiltroNome] = useState("");
  const [filtroOmbrellone, setFiltroOmbrellone] = useState("");
  const [filtroOrario, setFiltroOrario] = useState("");
  const hasActiveFilter = filtroNome.trim() !== "" || filtroOmbrellone.trim() !== "" || filtroOrario.trim() !== "";
  const resetFiltri = () => {
    setFiltroNome("");
    setFiltroOmbrellone("");
    setFiltroOrario("");
  };

  const filteredDataByStato: Record<Stato, Ordine[]> = useMemo(() => {
    const nome = filtroNome.trim().toLowerCase();
    const ombrellone = filtroOmbrellone.trim().toLowerCase();
    const orario = filtroOrario.trim();
    const matches = (o: Ordine) => {
      if (nome && !o.cognome.toLowerCase().includes(nome)) return false;
      if (ombrellone && !o.numero_ombrellone.toLowerCase().includes(ombrellone)) return false;
      if (orario) {
        const d = new Date(o.created_at);
        const orderTime = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
        if (orderTime < orario) return false;
      }
      return true;
    };
    return {
      arrivati: dataByStato.arrivati.filter(matches),
      da_evadere: dataByStato.da_evadere.filter(matches),
      consegnati: dataByStato.consegnati.filter(matches),
    };
  }, [dataByStato.arrivati, dataByStato.da_evadere, dataByStato.consegnati, filtroNome, filtroOmbrellone, filtroOrario]);

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-6">
      <div className="mb-5">
        <h1 className="text-2xl md:text-3xl font-bold text-primary">Ordini</h1>
        <p className="text-sm text-muted-foreground mt-1">Kanban in tempo reale degli ordini del lido.</p>
      </div>

      <FiltriBar
        nome={filtroNome}
        ombrellone={filtroOmbrellone}
        orario={filtroOrario}
        onNome={setFiltroNome}
        onOmbrellone={setFiltroOmbrellone}
        onOrario={setFiltroOrario}
        onReset={resetFiltri}
        hasActiveFilter={hasActiveFilter}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 overflow-x-auto">
        {columns.map((col) => (
          <KanbanColumn
            key={col.stato}
            stato={col.stato}
            title={col.title}
            headerCls={col.headerCls}
            orders={filteredDataByStato[col.stato]}
            onMove={move}
            selectedIds={col.stato === "consegnati" ? selectedIds : undefined}
            onToggleSelected={col.stato === "consegnati" ? toggleSelected : undefined}
            allSelected={allConsegnatiSelected}
            onToggleSelectAll={toggleSelectAll}
            onArchiveSelected={archiveSelected}
          />
        ))}
      </div>
    </div>
  );
}

function FiltriBar({
  nome, ombrellone, orario, onNome, onOmbrellone, onOrario, onReset, hasActiveFilter,
}: {
  nome: string;
  ombrellone: string;
  orario: string;
  onNome: (v: string) => void;
  onOmbrellone: (v: string) => void;
  onOrario: (v: string) => void;
  onReset: () => void;
  hasActiveFilter: boolean;
}) {
  return (
    <div className="mb-4 bg-white rounded-xl shadow-sm border border-border p-4 flex flex-col md:flex-row gap-3">
      <div className="flex-1 relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={nome}
          onChange={(e) => onNome(e.target.value)}
          placeholder="Cerca per cognome..."
          aria-label="Nome"
          className="h-9 w-full rounded-lg border border-border pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>
      <div className="flex-1 relative">
        <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={ombrellone}
          onChange={(e) => onOmbrellone(e.target.value)}
          placeholder="N. ombrellone..."
          aria-label="Ombrellone"
          className="h-9 w-full rounded-lg border border-border pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>
      <div className="flex-1 relative">
        <Clock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="time"
          value={orario}
          onChange={(e) => onOrario(e.target.value)}
          placeholder="Es. 14:30"
          aria-label="Orario"
          className="h-9 w-full rounded-lg border border-border pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>
      {hasActiveFilter && (
        <button
          onClick={onReset}
          className="h-9 px-3 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-secondary inline-flex items-center justify-center gap-1.5 shrink-0"
        >
          <X className="w-4 h-4" /> Azzera filtri
        </button>
      )}
    </div>
  );
}

function KanbanColumn({
  stato, title, headerCls, orders, onMove, selectedIds, onToggleSelected, allSelected, onToggleSelectAll, onArchiveSelected,
}: {
  stato: Stato;
  title: string;
  headerCls: string;
  orders: Ordine[];
  onMove: (id: string, s: Stato) => void;
  selectedIds?: Set<string>;
  onToggleSelected?: (id: string) => void;
  allSelected: boolean;
  onToggleSelectAll: () => void;
  onArchiveSelected: () => void;
}) {
  const { t } = useI18n();
  const selectable = stato === "consegnati";
  const selectedCount = selectable ? (selectedIds?.size ?? 0) : 0;
  return (
    <div className="rounded-2xl bg-secondary/40 border border-border p-3 min-w-[280px]">
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-semibold ${headerCls}`}>
        <span>{title}</span>
        <span className="bg-white/70 text-foreground text-xs px-1.5 py-0.5 rounded-full">{orders.length}</span>
      </div>

      {selectable && selectedCount > 0 && (
        <div className="sticky top-0 z-10 mt-3 rounded-xl bg-white border border-border shadow-sm p-2.5 flex items-center justify-between gap-2">
          <label className="inline-flex items-center gap-2 text-xs font-medium text-foreground">
            <input type="checkbox" checked={allSelected} onChange={onToggleSelectAll} className="w-4 h-4" />
            {t("kanban.selectAll")}
          </label>
          <span className="text-xs text-muted-foreground">{selectedCount} {t("kanban.selectedCount")}</span>
          <button
            onClick={onArchiveSelected}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-gray-200 text-gray-800 hover:bg-gray-300"
          >
            <Archive className="w-3.5 h-3.5" /> {t("kanban.archiveSelected")}
          </button>
        </div>
      )}

      <div className="mt-3 space-y-2.5 transition-all">
        {orders.length === 0 ? (
          <div className="text-xs text-muted-foreground py-10 text-center">{t("kanban.noOrders")}</div>
        ) : (
          orders.map((o) => (
            <OrderCard
              key={o.id}
              ordine={o}
              stato={stato}
              onMove={onMove}
              selectable={selectable}
              selected={selectedIds?.has(o.id) ?? false}
              onToggleSelected={onToggleSelected}
            />
          ))
        )}
      </div>
    </div>
  );
}

function OrderCard({ ordine, stato, onMove, selectable, selected, onToggleSelected }: {
  ordine: Ordine;
  stato: Stato;
  onMove: (id: string, s: Stato) => void;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelected?: (id: string) => void;
}) {
  const { t } = useI18n();
  useTick(1000);
  const style = STATO_STYLE[stato];
  const PillIcon = style.pillIcon;
  const pagamento = (ordine.metodo_pagamento ?? "contanti").toLowerCase();
  const isCarta = pagamento === "carta";

  return (
    <div className={`relative bg-white rounded-2xl border border-border border-l-2 ${style.border} shadow-sm p-3 transition`}>
      {selectable && (
        <input
          type="checkbox"
          checked={selected ?? false}
          onChange={() => onToggleSelected?.(ordine.id)}
          className="absolute top-3 left-3 w-4 h-4 z-10"
        />
      )}

      {/* Top row */}
      <div className={`flex items-start justify-between gap-2 ${selectable ? "pl-6" : ""}`}>
        <div>
          <div className="text-xs text-muted-foreground">Ordine</div>
          <div className="text-2xl font-bold text-primary leading-none">#{String(ordine.numero_ordine).padStart(3, "0")}</div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${style.pillBg}`}>
            <PillIcon className="w-3 h-3" /> {t(style.pillKey)}
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-border text-foreground">
            <Clock className="w-3 h-3" /> {formatElapsed(ordine.created_at)}
          </span>
        </div>
      </div>

      {/* Middle row */}
      <div className="mt-3 flex gap-3 items-start">
        <div className={`shrink-0 w-14 h-14 rounded-xl border flex flex-col items-center justify-center ${style.box}`}>
          <div className="text-[9px] font-semibold uppercase opacity-80 leading-none">Omb.</div>
          <div className="text-lg font-extrabold leading-none mt-0.5">{ordine.numero_ombrellone}</div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-base font-bold text-foreground truncate">{ordine.cognome}</div>
          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Omb. {ordine.numero_ombrellone}</span>
            {ordine.telefono && (
              <>
                <span>·</span>
                <a href={`tel:${ordine.telefono}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                  <Phone className="w-3.5 h-3.5" /> {ordine.telefono}
                </a>
              </>
            )}
          </div>
          <div className="mt-1.5">
            <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${
              isCarta ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"
            }`}>
              {isCarta ? <CreditCard className="w-3 h-3" /> : <Banknote className="w-3 h-3" />}
              {isCarta ? "Carta" : "Contanti"}
            </span>
          </div>
        </div>
      </div>

      {/* Items */}
      {ordine.ordine_items?.length > 0 && (
        <div className="mt-2.5 pt-2 border-t border-border space-y-0.5 text-xs text-foreground/85">
          {ordine.ordine_items.map((it) => (
            <div key={it.id} className="flex justify-between gap-2">
              <span className="truncate">{it.quantita}× {it.nome_snapshot}</span>
              <span className="text-muted-foreground shrink-0">{(it.prezzo_snapshot * it.quantita).toFixed(2)} €</span>
            </div>
          ))}
        </div>
      )}

      {ordine.note && (
        <div className="mt-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs p-2 flex gap-1.5">
          <StickyNote className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <div><span className="font-semibold">{t("kanban.notes")}:</span> {ordine.note}</div>
        </div>
      )}

      {/* Bottom row */}
      <div className="mt-2.5 pt-2 border-t border-border flex items-center justify-between text-sm font-bold">
        <span className="text-muted-foreground text-xs font-medium">{t("kanban.total")}</span>
        <span className="text-primary">€ {Number(ordine.totale).toFixed(2)}</span>
      </div>

      {stato === "arrivati" && (
        <button
          onClick={() => onMove(ordine.id, "da_evadere")}
          className="mt-3 w-full inline-flex items-center justify-center gap-1.5 text-sm font-semibold rounded-xl bg-slate-900 text-white h-10 hover:bg-slate-800"
        >
          {t("kanban.takeOver")} <ArrowRight className="w-4 h-4" />
        </button>
      )}
      {stato === "da_evadere" && (
        <button
          onClick={() => onMove(ordine.id, "consegnati")}
          className="mt-3 w-full inline-flex items-center justify-center gap-1.5 text-sm font-semibold rounded-xl bg-emerald-600 text-white h-10 hover:bg-emerald-700"
        >
          <CheckCheck className="w-4 h-4" /> {t("kanban.markDelivered")}
        </button>
      )}
    </div>
  );
}
