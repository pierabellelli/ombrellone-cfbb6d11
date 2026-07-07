import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { Umbrella, X, Check, Phone, Wallet, Clock, CupSoda, Mail } from "lucide-react";

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

type BookingStatus = "pending" | "confirmed" | "manually_held" | "expired" | "cancelled";
type Booking = {
  id: string;
  numero_ombrellone: string;
  fila: string;
  nome: string;
  cognome: string;
  email: string;
  telefono: string | null;
  data: string;
  status: BookingStatus;
};

export const Route = createFileRoute("/_authenticated/mappa")({
  head: () => ({ meta: [{ title: "Mappa ombrelloni · OmbrellOne" }] }),
  component: MappaPage,
});

async function loadCtx() {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { lidoId: null, config: null };
  const { data: lidoId } = await supabase.rpc("user_lido_id");
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

function todayLocalISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function loadBookingsOggi(lidoId: string): Promise<Booking[]> {
  const { data, error } = await supabase
    .from("bookings")
    .select("id, numero_ombrellone, fila, nome, cognome, email, telefono, data, status")
    .eq("lido_id", lidoId)
    .eq("data", todayLocalISO())
    .in("status", ["pending", "confirmed", "manually_held"]);
  if (error) throw error;
  return (data ?? []) as Booking[];
}

function bookingKey(fila: string, numero: number | string) {
  return `${fila}|${numero}`;
}

type UmbrellaState = "free" | "active" | "warn" | "late";
const STATE_RANK: Record<UmbrellaState, number> = { free: 0, active: 1, warn: 2, late: 3 };
function stateOfOrder(order: Ordine, now: number): UmbrellaState {
  const minutes = (now - new Date(order.created_at).getTime()) / 60000;
  if (minutes >= 15) return "late";
  if (minutes >= 10) return "warn";
  return "active";
}
function worstState(orders: Ordine[], now: number): UmbrellaState {
  let worst: UmbrellaState = "free";
  for (const o of orders) {
    const s = stateOfOrder(o, now);
    if (STATE_RANK[s] > STATE_RANK[worst]) worst = s;
  }
  return worst;
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

  const { data: bookings = [] } = useQuery({
    queryKey: ["mappa-bookings", lidoId],
    queryFn: () => loadBookingsOggi(lidoId!),
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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings", filter: `lido_id=eq.${lidoId}` },
        () => qc.invalidateQueries({ queryKey: ["mappa-bookings", lidoId] })
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [lidoId, qc]);

  const config = ctx?.config as { file: Fila[] } | null | undefined;
  const file = config?.file ?? [];

  // Map ombrellone number -> all active orders, oldest first
  const ordersByNumero = useMemo(() => {
    const map = new Map<string, Ordine[]>();
    for (const o of ordini) {
      const list = map.get(o.numero_ombrellone);
      if (list) list.push(o);
      else map.set(o.numero_ombrellone, [o]);
    }
    for (const list of map.values()) {
      list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }
    return map;
  }, [ordini]);

  const bookingsByKey = useMemo(() => {
    const map = new Map<string, Booking>();
    for (const b of bookings) map.set(bookingKey(b.fila, b.numero_ombrellone), b);
    return map;
  }, [bookings]);

  const [selected, setSelected] = useState<{ numero: number; fila: string } | null>(null);
  const selectedOrders = selected ? ordersByNumero.get(String(selected.numero)) ?? [] : [];
  const selectedBooking = selected ? bookingsByKey.get(bookingKey(selected.fila, selected.numero)) : undefined;

  const markDelivered = async (id: string) => {
    const { error } = await supabase.from("ordini").update({ stato: "consegnati" }).eq("id", id);
    if (error) { toast.error(t("map.updateError"), { description: error.message }); return; }
    toast.success(t("map.deliveredOk"));
    setSelected(null);
    qc.invalidateQueries({ queryKey: ["mappa-ordini", lidoId] });
  };

  return (
    <div style={{ overflow: "hidden", width: "100%", maxWidth: "100vw" }}>
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
          <div className="mt-6 card-soft p-4 md:p-5 space-y-5" style={{ overflowX: "hidden", width: "100%" }}>
            {/* Sea marker */}
            <div className="text-center text-xs font-semibold tracking-wider text-[color:var(--teal-deep)] uppercase">
              ≈ {lang === "it" ? "Mare" : "Sea"} ≈
            </div>

            {file.map((row) => (
              <div key={row.index}>
                <div className="text-xs font-semibold text-muted-foreground mb-2 px-1">{row.label}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", width: "100%", overflow: "hidden" }}>
                  {row.ombrelloni.map((u) => {
                    const orders = ordersByNumero.get(String(u.numero)) ?? [];
                    const s = worstState(orders, now);
                    const booking = bookingsByKey.get(bookingKey(row.label, u.numero));
                    return (
                      <UmbrellaTile
                        key={`${row.index}-${u.numero}`}
                        numero={u.numero}
                        rowLabel={row.label}
                        orders={orders}
                        state={s}
                        booking={booking}
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
            orders={selectedOrders}
            booking={selectedBooking}
            now={now}
            onClose={() => setSelected(null)}
            onDelivered={markDelivered}
          />
        )}
      </div>
    </div>
  );
}

const STATE_CLASS: Record<UmbrellaState, string> = {
  free: "bg-[color:var(--sky-tint)] border-[color:var(--teal-deep)]/30 text-primary",
  active: "bg-emerald-100 border-emerald-400 text-emerald-900",
  warn: "bg-amber-100 border-amber-400 text-amber-900",
  late: "bg-red-100 border-red-400 text-red-900",
};

type BookingTileState = "libero" | "prenotato" | "occupato";
function bookingTileState(b: Booking | undefined): BookingTileState {
  if (!b) return "libero";
  if (b.status === "confirmed") return "occupato";
  return "prenotato";
}

const BOOKING_STATE_CLASS: Record<BookingTileState, string> = {
  libero: "bg-white border-gray-300 text-foreground",
  prenotato: "bg-[#bfbbae] border-[#938e7c] text-gray-900",
  occupato: "bg-sky-100 border-sky-400 text-sky-900",
};

const TILE_CLASS: Record<BookingTileState, string> = {
  libero: "bg-white border-gray-300",
  prenotato: "bg-[#bfbbae] border-[#938e7c]",
  occupato: "bg-sky-100 border-sky-400",
};

const DRINK_BADGE_CLASS: Record<Exclude<UmbrellaState, "free">, string> = {
  active: "bg-emerald-500 text-white",
  warn: "bg-amber-500 text-white",
  late: "bg-red-500 text-white",
};

const TILE_ACCENT: Record<UmbrellaState, string> = {
  free: "text-foreground",
  active: "text-emerald-700",
  warn: "text-amber-700",
  late: "text-red-700",
};

function fmtElapsed(ms: number) {
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function fmtElapsedShort(ms: number) {
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  if (totalMin < 60) return `${totalMin}min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${m}min`;
}

function UmbrellaTile({ numero, rowLabel, orders, state, booking, now, onClick }: {
  numero: number; rowLabel: string; orders: Ordine[]; state: UmbrellaState; booking: Booking | undefined; now: number; onClick: () => void;
}) {
  const oldest = orders[0];
  const elapsed = oldest ? now - new Date(oldest.created_at).getTime() : 0;
  const accent = TILE_ACCENT[state];
  const bookingState = bookingTileState(booking);
  return (
    <button
      onClick={onClick}
      className={`relative min-h-[88px] rounded-2xl border-2 ${TILE_CLASS[bookingState]} flex flex-col items-center transition active:scale-95 shadow-sm`}
      style={{
        width: "80px",
        minWidth: "80px",
        maxWidth: "80px",
        flexShrink: 0,
        flexGrow: 0,
        overflow: "visible",
      }}
    >
      {bookingState === "prenotato" && (
        <span className="absolute top-1 left-1/2 -translate-x-1/2 z-10 w-6 h-6 rounded-full bg-white border border-gray-400 text-gray-900 text-[11px] font-bold flex items-center justify-center shadow-sm">
          P
        </span>
      )}
      <div className="absolute -top-1.5 -right-1.5 z-10 flex items-center">
        {bookingState === "occupato" && (
          <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-sm ring-2 ring-white">
            <Check className="w-3 h-3" />
          </span>
        )}
        {state !== "free" && (
          <span className={`w-8 h-8 rounded-full flex items-center justify-center shadow-sm ring-2 ring-white -ml-1.5 ${DRINK_BADGE_CLASS[state]}`}>
            <CupSoda className="w-5 h-5" />
          </span>
        )}
      </div>
      <div className="px-1.5 py-1.5 flex flex-col items-center w-full flex-1 justify-center overflow-hidden rounded-2xl">
        <Umbrella className={`w-4 h-4 ${accent} ${state === "free" ? "opacity-70" : ""}`} />
        <div className="flex items-center justify-center gap-1">
          <div className={`text-lg font-extrabold leading-tight ${accent}`}>{numero}</div>
          {orders.length > 1 && (
            <span className="w-5 h-5 rounded-full bg-gray-500 text-white text-[10px] font-bold flex items-center justify-center shadow-sm shrink-0">
              {orders.length}
            </span>
          )}
        </div>
        {oldest ? (
          <div className={`text-[10px] tabular-nums truncate w-full text-center font-semibold ${accent}`}>
            {fmtElapsedShort(elapsed)}
          </div>
        ) : (
          <div className="text-[10px] opacity-70 truncate w-full text-center">{rowLabel}</div>
        )}
      </div>
    </button>
  );
}

function Legend({ t }: { t: (k: any) => string }) {
  const bookingItems: [BookingTileState, string][] = [
    ["libero", t("map.legend.free")],
    ["prenotato", t("map.legend.reserved")],
    ["occupato", t("map.legend.occupied")],
  ];
  const orderItems: [Exclude<UmbrellaState, "free">, string][] = [
    ["active", t("map.legend.active")],
    ["warn", t("map.legend.warn")],
    ["late", t("map.legend.late")],
  ];
  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        {bookingItems.map(([s, lbl]) => (
          <span key={s} className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border-2 ${BOOKING_STATE_CLASS[s]}`}>
            <span className="w-2 h-2 rounded-full bg-current opacity-70" />
            {lbl}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {orderItems.map(([s, lbl]) => (
          <span key={s} className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border-2 ${STATE_CLASS[s]}`}>
            <CupSoda className="w-3 h-3" />
            {lbl}
          </span>
        ))}
      </div>
    </div>
  );
}

function DetailSheet({ numero, fila, orders, booking, now, onClose, onDelivered }: {
  numero: number; fila: string; orders: Ordine[]; booking: Booking | undefined; now: number; onClose: () => void; onDelivered: (id: string) => void;
}) {
  const { t } = useI18n();
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

        {booking && (
          <div className="mt-5 rounded-2xl border border-border p-3">
            <BookingDetailCard booking={booking} />
          </div>
        )}

        {orders.length === 0 ? (
          <div className="mt-8 text-center text-muted-foreground py-12">{t("map.noOrder")}</div>
        ) : orders.length === 1 ? (
          <div className="mt-5">
            <OrderDetailCard order={orders[0]} now={now} onDelivered={onDelivered} />
          </div>
        ) : (
          <div className="mt-5 space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            {orders.map((o) => (
              <div key={o.id} className="rounded-2xl border border-border p-3">
                <OrderDetailCard order={o} now={now} onDelivered={onDelivered} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function OrderDetailCard({ order, now, onDelivered }: { order: Ordine; now: number; onDelivered: (id: string) => void }) {
  const { t } = useI18n();
  const elapsed = now - new Date(order.created_at).getTime();
  return (
    <div className="space-y-4">
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
  );
}

function BookingDetailCard({ booking }: { booking: Booking }) {
  const { t } = useI18n();
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{t("map.booking.title")}</div>
        <BookingStatusBadge status={booking.status} />
      </div>
      <Row label={t("map.customer")} value={`${booking.nome} ${booking.cognome}`} />
      <Row label={t("map.booking.date")} value={booking.data} />
      <Row label={t("map.booking.type")} value={booking.status === "manually_held" ? t("map.booking.manual") : t("map.booking.normal")} />
      {booking.email && (
        <Row
          label={t("map.booking.email")}
          value={<a href={`mailto:${booking.email}`} className="inline-flex items-center gap-1.5 text-primary underline"><Mail className="w-3.5 h-3.5" />{booking.email}</a>}
        />
      )}
      {booking.telefono && (
        <Row label={t("map.phone")} value={<a href={`tel:${booking.telefono}`} className="inline-flex items-center gap-1.5 text-primary underline"><Phone className="w-3.5 h-3.5" />{booking.telefono}</a>} />
      )}
    </div>
  );
}

function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const { t } = useI18n();
  const map: Record<BookingStatus, string> = {
    pending: "bg-gray-200 text-gray-800",
    confirmed: "bg-blue-100 text-blue-800",
    manually_held: "bg-gray-200 text-gray-800",
    expired: "bg-red-100 text-red-800",
    cancelled: "bg-red-100 text-red-800",
  };
  const key: Record<BookingStatus, any> = {
    pending: "map.booking.pending",
    confirmed: "map.booking.confirmed",
    manually_held: "map.booking.manuallyHeld",
    expired: "map.booking.expired",
    cancelled: "map.booking.cancelled",
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${map[status]}`}>{t(key[status])}</span>;
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
