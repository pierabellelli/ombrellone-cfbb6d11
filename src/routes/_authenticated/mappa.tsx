import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { Umbrella, X, Check, Phone, Wallet, Clock } from "lucide-react";

type Fila = { index: number; label: string; ombrelloni: { numero: number }[] };
type Stato = "arrivati" | "da_evadere" | "consegnati" | "annullato";
type Item = { id: string; nome_snapshot: string; prezzo_snapshot: number; quantita: number };
type Ordine = {
  id: string;
  numero_ordine: number;
  numero_ombrellone: string;
  cognome: string;
  telefono: string | null;
  metodo_pagamento: string | null;
  totale: number;
  stato: Stato;
  created_at: string;
  fila: string | null;
  ordine_items?: Item[];
};

export const Route = createFileRoute("/_authenticated/mappa")({
  head: () => ({ meta: [{ title: "Mappa ombrelloni · OmbrellOne" }] }),
  component: MappaPage,
});

async function loadCtx() {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { lidoId: null, config: null };
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role, lido_id")
    .eq("user_id", u.user.id);
  const r = roles ?? [];
  const lidoId = r.find((x) => x.lido_id)?.lido_id ?? null;
  if (!lidoId) return { lidoId: null, config: null };
  const { data: config } = await supabase
    .from("beach_config")
    .select("*")
    .eq("lido_id", lidoId)
    .maybeSingle();
  return { lidoId, config };
}

async function loadOrdiniAttivi(lidoId: string): Promise<Ordine[]> {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const { data, error } = await supabase
    .from("ordini")
    .select("id, numero_ordine, numero_ombrellone, cognome, telefono, metodo_pagamento, totale, stato, created_at, fila, ordine_items(id, nome_snapshot, prezzo_snapshot, quantita)")
    .eq("lido_id", lidoId)
    .gte("created_at", today.toISOString())
    .in("stato", ["arrivati", "da_evadere"]);
  if (error) throw error;
  return (data ?? []) as unknown as Ordine[];
}

type UmbrellaState = "free" | "active" | "warn" | "late";
function stateOf(order: Ordine | undefined, now: number): UmbrellaState {
  if (!order) return "free";
  const minutes = (now - new Date(order.created_at).getTime()) / 60000;
  if (minutes >= 15) return "late";
  if (minutes >= 10) return "warn";
  return "active";
}

function MappaPage() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const { data: ctx } = useQuery({ queryKey: ["mappa-ctx"], queryFn: loadCtx });
  const lidoId = ctx?.lidoId ?? null;

  const { data: ordini = [] } = useQuery({
    queryKey: ["mappa-ordini", lidoId],
    queryFn: () => loadOrdiniAttivi(lidoId!),
    enabled: !!lidoId,
    refetchOnWindowFocus: false,
  });

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Realtime subscription
  useEffect(() => {
    if (!lidoId) return;
    const ch = supabase
      .channel(`mappa-ordini-${lidoId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ordini", filter: `lido_id=eq.${lidoId}` },
        () => qc.invalidateQueries({ queryKey: ["mappa-ordini", lidoId] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "beach_config", filter: `lido_id=eq.${lidoId}` },
        () => qc.invalidateQueries({ queryKey: ["mappa-ctx"] })
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [lidoId, qc]);

  const config = ctx?.config as { file: Fila[] } | null | undefined;
  const file = config?.file ?? [];

  // Map ombrellone number -> latest active order
  const orderByNumero = useMemo(() => {
    const map = new Map<string, Ordine>();
    for (const o of ordini) {
      const existing = map.get(o.numero_ombrellone);
      if (!existing || new Date(o.created_at) > new Date(existing.created_at)) {
        map.set(o.numero_ombrellone, o);
      }
    }
    return map;
  }, [ordini]);

  const [selected, setSelected] = useState<{ numero: number; fila: string } | null>(null);
  const selectedOrder = selected ? orderByNumero.get(String(selected.numero)) : undefined;

  const markDelivered = async (id: string) => {
    const { error } = await supabase.from("ordini").update({ stato: "consegnati" }).eq("id", id);
    if (error) { toast.error(t("map.updateError"), { description: error.message }); return; }
    toast.success(t("map.deliveredOk"));
    setSelected(null);
    qc.invalidateQueries({ queryKey: ["mappa-ordini", lidoId] });
  };

  return (
    <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-primary">{t("map.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("map.subtitle")}</p>
        </div>
        <Legend t={t} />
      </div>

      {file.length === 0 ? (
        <div className="mt-8 card-soft p-8 text-center text-muted-foreground">{t("map.noConfig")}</div>
      ) : (
        <div className="mt-6 card-soft p-4 md:p-5 space-y-5 overflow-x-auto">
          {/* Sea marker */}
          <div className="text-center text-xs font-semibold tracking-wider text-[color:var(--teal-deep)] uppercase">
            ≈ {lang === "it" ? "Mare" : "Sea"} ≈
          </div>

          {file.map((row) => (
            <div key={row.index}>
              <div className="text-xs font-semibold text-muted-foreground mb-2 px-1">{row.label}</div>
              <div className="flex flex-wrap gap-2.5">
                {row.ombrelloni.map((u) => {
                  const order = orderByNumero.get(String(u.numero));
                  const s = stateOf(order, now);
                  return (
                    <UmbrellaTile
                      key={`${row.index}-${u.numero}`}
                      numero={u.numero}
                      rowLabel={row.label}
                      order={order}
                      state={s}
                      now={now}
                      onClick={() => setSelected({ numero: u.numero, fila: row.label })}
                    />
                  );
                })}
              </div>
            </div>
          ))}

          <div className="text-center text-xs font-semibold tracking-wider text-amber-700/70 uppercase pt-2 border-t border-dashed border-border">
            ☼ {lang === "it" ? "Entrata" : "Entrance"} ☼
          </div>
        </div>
      )}

      {selected && (
        <DetailSheet
          numero={selected.numero}
          fila={selected.fila}
          order={selectedOrder}
          now={now}
          onClose={() => setSelected(null)}
          onDelivered={markDelivered}
        />
      )}
    </div>
  );
}

const STATE_CLASS: Record<UmbrellaState, string> = {
  free: "bg-[color:var(--sky-tint)] border-[color:var(--teal-deep)]/30 text-primary",
  active: "bg-emerald-100 border-emerald-400 text-emerald-900",
  warn: "bg-amber-100 border-amber-400 text-amber-900",
  late: "bg-red-100 border-red-400 text-red-900",
};

function fmtElapsed(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const ss = String(s % 60).padStart(2, "0");
  return `${m}:${ss}`;
}

function UmbrellaTile({ numero, rowLabel, order, state, now, onClick }: {
  numero: number; rowLabel: string; order?: Ordine; state: UmbrellaState; now: number; onClick: () => void;
}) {
  const elapsed = order ? now - new Date(order.created_at).getTime() : 0;
  return (
    <button
      onClick={onClick}
      className={`relative w-[88px] min-h-[88px] rounded-2xl border-2 ${STATE_CLASS[state]} px-1.5 py-2 flex flex-col items-center justify-start transition active:scale-95 shadow-sm`}
    >
      <Umbrella className="w-4 h-4 opacity-70" />
      <div className="text-lg font-extrabold leading-tight">{numero}</div>
      <div className="text-[10px] opacity-70 truncate w-full text-center">{rowLabel}</div>
      {order && (
        <div className="mt-1 w-full">
          <div className="text-[11px] font-semibold truncate">{order.cognome}</div>
          <div className="text-[10px] tabular-nums opacity-80">{fmtElapsed(elapsed)}</div>
        </div>
      )}
    </button>
  );
}

function Legend({ t }: { t: (k: any) => string }) {
  const items: [UmbrellaState, string][] = [
    ["free", t("map.legend.free")],
    ["active", t("map.legend.active")],
    ["warn", t("map.legend.warn")],
    ["late", t("map.legend.late")],
  ];
  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.map(([s, lbl]) => (
        <span key={s} className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border-2 ${STATE_CLASS[s]}`}>
          <span className="w-2 h-2 rounded-full bg-current opacity-70" />
          {lbl}
        </span>
      ))}
    </div>
  );
}

function DetailSheet({ numero, fila, order, now, onClose, onDelivered }: {
  numero: number; fila: string; order?: Ordine; now: number; onClose: () => void; onDelivered: (id: string) => void;
}) {
  const { t } = useI18n();
  const elapsed = order ? now - new Date(order.created_at).getTime() : 0;
  return (
    <div className="fixed inset-0 z-40 flex items-end md:items-center md:justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-card w-full md:w-[440px] md:h-full rounded-t-3xl md:rounded-t-none md:rounded-l-3xl shadow-2xl p-6 overflow-y-auto max-h-[90vh] md:max-h-none">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{fila}</div>
            <div className="text-2xl font-bold text-primary inline-flex items-center gap-2">
              <Umbrella className="w-5 h-5 text-[color:var(--teal-deep)]" />
              {t("map.umbrella")} {numero}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!order ? (
          <div className="mt-8 text-center text-muted-foreground py-12">{t("map.noOrder")}</div>
        ) : (
          <div className="mt-5 space-y-4">
            <Row label={t("map.customer")} value={order.cognome} />
            {order.telefono && (
              <Row label={t("map.phone")} value={<a href={`tel:${order.telefono}`} className="inline-flex items-center gap-1.5 text-primary underline"><Phone className="w-3.5 h-3.5" />{order.telefono}</a>} />
            )}
            <Row
              label={t("map.elapsed")}
              value={<span className="inline-flex items-center gap-1.5 tabular-nums font-semibold"><Clock className="w-3.5 h-3.5" />{fmtElapsed(elapsed)}</span>}
            />
            <Row label={t("map.status")} value={<StatusBadge stato={order.stato} />} />
            {order.metodo_pagamento && (
              <Row
                label={t("map.payment")}
                value={
                  <span className="inline-flex items-center gap-1.5">
                    <Wallet className="w-3.5 h-3.5" />
                    {order.metodo_pagamento === "carta" ? t("map.payment.card") : t("map.payment.cash")}
                  </span>
                }
              />
            )}

            <div>
              <div className="text-xs text-muted-foreground mb-1.5">{t("map.items")}</div>
              <ul className="rounded-xl border border-border divide-y divide-border">
                {(order.ordine_items ?? []).map((it) => (
                  <li key={it.id} className="flex justify-between px-3 py-2 text-sm">
                    <span>{it.quantita}× {it.nome_snapshot}</span>
                    <span className="text-muted-foreground tabular-nums">{(it.prezzo_snapshot * it.quantita).toFixed(2)} €</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-sm text-muted-foreground">{t("map.total")}</span>
              <span className="text-xl font-bold text-primary tabular-nums">{Number(order.totale).toFixed(2)} €</span>
            </div>

            <button
              onClick={() => onDelivered(order.id)}
              className="w-full mt-2 inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl brand-gradient text-white font-semibold"
            >
              <Check className="w-4 h-4" /> {t("map.markDelivered")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground text-right">{value}</span>
    </div>
  );
}

function StatusBadge({ stato }: { stato: Stato }) {
  const map: Record<Stato, string> = {
    arrivati: "bg-blue-100 text-blue-800",
    da_evadere: "bg-amber-100 text-amber-800",
    consegnati: "bg-emerald-100 text-emerald-800",
    annullato: "bg-red-100 text-red-800",
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${map[stato]}`}>{stato.replace("_", " ")}</span>;
}
