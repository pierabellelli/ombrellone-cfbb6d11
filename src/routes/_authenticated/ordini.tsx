import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Clock, Phone, MapPin, Banknote, CreditCard, StickyNote, ArrowRight, CheckCircle2 } from "lucide-react";
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
  head: () => ({ meta: [{ title: "Ordini · LidoSmart" }] }),
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
  const { data, error } = await supabase.rpc("user_lido_id", { _user_id: u.user.id });
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
  if (stato === "consegnati") q = q.gte("created_at", startOfTodayISO());
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

function elapsedMinutes(iso: string) {
  return (Date.now() - new Date(iso).getTime()) / 60000;
}

function formatElapsed(iso: string) {
  const totSec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  const m = Math.floor(totSec / 60);
  const s = totSec % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

function urgencyTone(iso: string) {
  const m = elapsedMinutes(iso);
  if (m >= 15) return { border: "border-l-red-500", text: "text-red-600", bg: "bg-red-50" };
  if (m >= 10) return { border: "border-l-amber-500", text: "text-amber-700", bg: "bg-amber-50" };
  return { border: "border-l-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50" };
}

function OrdiniPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  const { data: lidoId } = useQuery({
    queryKey: ["user-lido-id"],
    queryFn: fetchUserLidoId,
    staleTime: 60_000,
  });

  const enabled = !!lidoId;
  const queries = (["arrivati", "da_evadere", "consegnati"] as Stato[]).map((s) =>
    useQuery({
      queryKey: ["ordini-col", s, lidoId],
      queryFn: () => loadColonna(s, lidoId!),
      enabled,
    }),
  );
  const [nuovi, prep, consegnati] = queries;

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
    const { error } = await supabase.from("ordini").update({ stato: nuovoStato }).eq("id", id);
    if (error) { toast.error(t("kanban.updateError"), { description: error.message }); return; }
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

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-6">
      <div className="mb-5">
        <h1 className="text-2xl md:text-3xl font-bold text-primary">Ordini</h1>
        <p className="text-sm text-muted-foreground mt-1">Kanban in tempo reale degli ordini del lido.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 overflow-x-auto">
        {columns.map((col) => (
          <KanbanColumn
            key={col.stato}
            stato={col.stato}
            title={col.title}
            headerCls={col.headerCls}
            orders={dataByStato[col.stato]}
            onMove={move}
          />
        ))}
      </div>
    </div>
  );
}

function KanbanColumn({
  stato, title, headerCls, orders, onMove,
}: {
  stato: Stato;
  title: string;
  headerCls: string;
  orders: Ordine[];
  onMove: (id: string, s: Stato) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="rounded-2xl bg-secondary/40 border border-border p-3 min-w-[280px]">
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-semibold ${headerCls}`}>
        <span>{title}</span>
        <span className="bg-white/70 text-foreground text-xs px-1.5 py-0.5 rounded-full">{orders.length}</span>
      </div>
      <div className="mt-3 space-y-2.5 transition-all">
        {orders.length === 0 ? (
          <div className="text-xs text-muted-foreground py-10 text-center">{t("kanban.noOrders")}</div>
        ) : (
          orders.map((o) => <OrderCard key={o.id} ordine={o} stato={stato} onMove={onMove} />)
        )}
      </div>
    </div>
  );
}

function OrderCard({ ordine, stato, onMove }: { ordine: Ordine; stato: Stato; onMove: (id: string, s: Stato) => void }) {
  const { t } = useI18n();
  useTick(1000);
  const tone = urgencyTone(ordine.created_at);
  const pagamento = (ordine.metodo_pagamento ?? "contanti").toLowerCase();
  const isCarta = pagamento === "carta";

  return (
    <div className={`bg-white rounded-2xl border border-border border-l-4 ${tone.border} shadow-sm p-3 transition`}>
      <div className="flex items-start justify-between gap-2">
        <div className="font-bold text-primary">#{String(ordine.numero_ordine).padStart(3, "0")}</div>
        <div className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${tone.bg} ${tone.text}`}>
          <Clock className="w-3.5 h-3.5" /> {formatElapsed(ordine.created_at)}
        </div>
      </div>

      <div className="mt-1.5 text-sm font-semibold text-foreground leading-tight">
        {ordine.cognome}
      </div>
      <div className="text-xs text-muted-foreground mt-0.5 inline-flex items-center gap-1">
        <MapPin className="w-3.5 h-3.5" /> Omb. {ordine.numero_ombrellone}
        {ordine.fila ? <span> · Fila {ordine.fila}</span> : null}
      </div>

      {ordine.telefono && (
        <a
          href={`tel:${ordine.telefono}`}
          className="mt-1.5 inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <Phone className="w-3.5 h-3.5" /> {ordine.telefono}
        </a>
      )}

      <div className="mt-2">
        <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${
          isCarta ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"
        }`}>
          {isCarta ? <CreditCard className="w-3 h-3" /> : <Banknote className="w-3 h-3" />}
          {isCarta ? "Carta" : "Contanti"}
        </span>
      </div>

      {ordine.ordine_items?.length > 0 && (
        <ul className="mt-2.5 space-y-0.5 text-xs text-foreground/85 border-t border-border pt-2">
          {ordine.ordine_items.map((it) => (
            <li key={it.id} className="flex justify-between gap-2">
              <span className="truncate">{it.quantita}× {it.nome_snapshot}</span>
              <span className="text-muted-foreground shrink-0">{(it.prezzo_snapshot * it.quantita).toFixed(2)} €</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2 flex items-center justify-between text-sm font-bold">
        <span className="text-muted-foreground text-xs font-medium">{t("kanban.total")}</span>
        <span className="text-primary">€ {Number(ordine.totale).toFixed(2)}</span>
      </div>

      {ordine.note && (
        <div className="mt-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs p-2 flex gap-1.5">
          <StickyNote className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <div><span className="font-semibold">{t("kanban.notes")}:</span> {ordine.note}</div>
        </div>
      )}

      {stato === "arrivati" && (
        <button
          onClick={() => onMove(ordine.id, "da_evadere")}
          className="mt-3 w-full inline-flex items-center justify-center gap-1.5 text-sm font-semibold rounded-xl bg-primary text-primary-foreground h-10 hover:opacity-95"
        >
          {t("kanban.takeOver")} <ArrowRight className="w-4 h-4" />
        </button>
      )}
      {stato === "da_evadere" && (
        <button
          onClick={() => onMove(ordine.id, "consegnati")}
          className="mt-3 w-full inline-flex items-center justify-center gap-1.5 text-sm font-semibold rounded-xl bg-emerald-600 text-white h-10 hover:bg-emerald-700"
        >
          <CheckCircle2 className="w-4 h-4" /> {t("kanban.markDelivered")}
        </button>
      )}
    </div>
  );
}
