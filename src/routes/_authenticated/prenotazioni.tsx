import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search, X, Phone, Mail, Clock, CalendarClock, CheckCircle2, Ban, ShieldCheck, AlertTriangle } from "lucide-react";

type BookingStatus = "pending" | "confirmed" | "expired" | "manually_held" | "cancelled";

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
  expires_at: string | null;
  checked_in_at: string | null;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/prenotazioni")({
  head: () => ({ meta: [{ title: "Prenotazioni · OmbrellOne" }] }),
  component: PrenotazioniPage,
});

const SELECT_COLS =
  "id, numero_ombrellone, fila, nome, cognome, email, telefono, data, status, expires_at, checked_in_at, created_at";

function todayLocalISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function loadCtx() {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { lidoId: null, canManage: false };
  const { data: roles } = await supabase.from("user_roles").select("role, lido_id").eq("user_id", u.user.id);
  const isGestore = (roles ?? []).some((r) => r.role === "gestore");
  const isSuper = (roles ?? []).some((r) => r.role === "super_admin");
  const isStaff = (roles ?? []).some((r) => r.role === "staff");
  const lidoId = (roles ?? []).find((r) => r.lido_id)?.lido_id ?? null;
  let staffCanManage = false;
  if (lidoId) {
    const { data: lido } = await supabase
      .from("lidi")
      .select("staff_can_manage_bookings")
      .eq("id", lidoId)
      .maybeSingle();
    staffCanManage = lido?.staff_can_manage_bookings ?? false;
  }
  const canManage = isGestore || isSuper || (isStaff && staffCanManage);
  return { lidoId, canManage };
}

async function loadColonna(status: BookingStatus, lidoId: string): Promise<Booking[]> {
  const { data, error } = await supabase
    .from("bookings")
    .select(SELECT_COLS)
    .eq("lido_id", lidoId)
    .eq("status", status)
    .gte("data", todayLocalISO())
    .order("data", { ascending: true })
    .order("expires_at", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as Booking[];
}

const COLUMNS: { status: BookingStatus; title: string; headerCls: string }[] = [
  { status: "pending", title: "Pending", headerCls: "bg-gray-200 text-gray-800 border-gray-300" },
  { status: "confirmed", title: "Confermate", headerCls: "bg-blue-100 text-blue-800 border-blue-200" },
  { status: "expired", title: "Scadute", headerCls: "bg-red-100 text-red-800 border-red-200" },
  { status: "manually_held", title: "Manually Held", headerCls: "bg-amber-100 text-amber-900 border-amber-200" },
];

function fmtTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function PrenotazioniPage() {
  const qc = useQueryClient();
  const { data: ctx } = useQuery({ queryKey: ["prenotazioni-ctx"], queryFn: loadCtx });
  const lidoId = ctx?.lidoId ?? null;
  const canManage = ctx?.canManage ?? false;
  const enabled = !!lidoId;

  const pending = useQuery({ queryKey: ["bookings-col", "pending", lidoId], queryFn: () => loadColonna("pending", lidoId!), enabled });
  const confirmed = useQuery({ queryKey: ["bookings-col", "confirmed", lidoId], queryFn: () => loadColonna("confirmed", lidoId!), enabled });
  const expired = useQuery({ queryKey: ["bookings-col", "expired", lidoId], queryFn: () => loadColonna("expired", lidoId!), enabled });
  const manuallyHeld = useQuery({ queryKey: ["bookings-col", "manually_held", lidoId], queryFn: () => loadColonna("manually_held", lidoId!), enabled });

  const dataByStatus: Record<BookingStatus, Booking[]> = {
    pending: pending.data ?? [],
    confirmed: confirmed.data ?? [],
    expired: expired.data ?? [],
    manually_held: manuallyHeld.data ?? [],
    cancelled: [],
  };

  const invalidateAll = () => qc.invalidateQueries({ queryKey: ["bookings-col"] });

  // Realtime: refetch on any change + toast for new pending bookings
  const knownPendingIds = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (pending.data === undefined) return;
    const list = pending.data;
    const ids = new Set(list.map((b) => b.id));
    if (knownPendingIds.current === null) {
      knownPendingIds.current = ids;
      return;
    }
    const nuove = list.filter((b) => !knownPendingIds.current!.has(b.id));
    for (const b of nuove) {
      toast.info("Nuova prenotazione", { description: `${b.cognome} · ${b.fila} ${b.numero_ombrellone} · ${b.data}` });
    }
    knownPendingIds.current = ids;
  }, [pending.data]);

  useEffect(() => {
    if (!lidoId) return;
    const ch = supabase
      .channel(`prenotazioni-${lidoId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings", filter: `lido_id=eq.${lidoId}` },
        invalidateAll,
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lidoId, qc]);

  // Notify 15 minutes before expiry, once per booking
  const notifiedExpiring = useRef<Set<string>>(new Set());
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      for (const b of pending.data ?? []) {
        if (!b.expires_at || notifiedExpiring.current.has(b.id)) continue;
        const msLeft = new Date(b.expires_at).getTime() - now;
        if (msLeft > 0 && msLeft <= 15 * 60000) {
          notifiedExpiring.current.add(b.id);
          toast.warning("Prenotazione in scadenza", { description: `${b.cognome} · ${b.fila} ${b.numero_ombrellone} scade alle ${fmtTime(b.expires_at)}` });
        }
      }
    }, 30_000);
    return () => clearInterval(id);
  }, [pending.data]);

  const checkIn = async (id: string) => {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("bookings")
      .update({ status: "confirmed", checked_in_at: new Date().toISOString(), checked_in_by: u.user?.id ?? null })
      .eq("id", id);
    if (error) { toast.error("Aggiornamento non riuscito", { description: error.message }); return; }
    toast.success("Check-in effettuato");
    invalidateAll();
  };

  const holdManually = async (id: string) => {
    const { error } = await supabase.from("bookings").update({ status: "manually_held" }).eq("id", id);
    if (error) { toast.error("Aggiornamento non riuscito", { description: error.message }); return; }
    toast.success("Riservato manualmente");
    invalidateAll();
  };

  const cancel = async (id: string) => {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("bookings")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancelled_by: u.user?.id ?? null })
      .eq("id", id);
    if (error) { toast.error("Aggiornamento non riuscito", { description: error.message }); return; }
    toast.success("Prenotazione cancellata");
    invalidateAll();
  };

  const [search, setSearch] = useState("");
  const filteredByStatus: Record<BookingStatus, Booking[]> = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matches = (b: Booking) => {
      if (!q) return true;
      return (
        b.cognome.toLowerCase().includes(q) ||
        b.nome.toLowerCase().includes(q) ||
        b.numero_ombrellone.toLowerCase().includes(q) ||
        b.fila.toLowerCase().includes(q) ||
        b.data.includes(q)
      );
    };
    return {
      pending: dataByStatus.pending.filter(matches),
      confirmed: dataByStatus.confirmed.filter(matches),
      expired: dataByStatus.expired.filter(matches),
      manually_held: dataByStatus.manually_held.filter(matches),
      cancelled: [],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, pending.data, confirmed.data, expired.data, manuallyHeld.data]);

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-6">
      <div className="mb-5">
        <h1 className="text-2xl md:text-3xl font-bold text-primary">Prenotazioni</h1>
        <p className="text-sm text-muted-foreground mt-1">Kanban in tempo reale delle prenotazioni del lido.</p>
      </div>

      <div className="mb-4 bg-white rounded-xl shadow-sm border border-border p-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca per ombrellone, cognome o data..."
            aria-label="Cerca prenotazioni"
            className="h-9 w-full rounded-lg border border-border pl-8 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 overflow-x-auto">
        {COLUMNS.map((col) => (
          <BookingColumn
            key={col.status}
            status={col.status}
            title={col.title}
            headerCls={col.headerCls}
            bookings={filteredByStatus[col.status]}
            canManage={canManage}
            onCheckIn={checkIn}
            onHoldManually={holdManually}
            onCancel={cancel}
          />
        ))}
      </div>
    </div>
  );
}

function BookingColumn({
  status, title, headerCls, bookings, canManage, onCheckIn, onHoldManually, onCancel,
}: {
  status: BookingStatus;
  title: string;
  headerCls: string;
  bookings: Booking[];
  canManage: boolean;
  onCheckIn: (id: string) => void;
  onHoldManually: (id: string) => void;
  onCancel: (id: string) => void;
}) {
  return (
    <div className="rounded-2xl bg-secondary/40 border border-border p-3 min-w-[280px]">
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-semibold ${headerCls}`}>
        <span>{title}</span>
        <span className="bg-white/70 text-foreground text-xs px-1.5 py-0.5 rounded-full">{bookings.length}</span>
      </div>

      <div className="mt-3 space-y-2.5">
        {bookings.length === 0 ? (
          <div className="text-xs text-muted-foreground py-10 text-center">Nessuna prenotazione</div>
        ) : (
          bookings.map((b) => (
            <BookingCard
              key={b.id}
              booking={b}
              canManage={canManage}
              onCheckIn={onCheckIn}
              onHoldManually={onHoldManually}
              onCancel={onCancel}
            />
          ))
        )}
      </div>
    </div>
  );
}

function BookingCard({ booking, canManage, onCheckIn, onHoldManually, onCancel }: {
  booking: Booking;
  canManage: boolean;
  onCheckIn: (id: string) => void;
  onHoldManually: (id: string) => void;
  onCancel: (id: string) => void;
}) {
  const isManual = booking.status === "manually_held";
  return (
    <div className="relative bg-white rounded-2xl border border-border shadow-sm p-3 transition">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-base font-bold text-foreground">{booking.nome} {booking.cognome}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{booking.fila} · Ombrellone {booking.numero_ombrellone}</div>
        </div>
        {isManual && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
            <ShieldCheck className="w-3 h-3" /> Manuale
          </span>
        )}
      </div>

      <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
        <span className="inline-flex items-center gap-1"><CalendarClock className="w-3.5 h-3.5" /> {booking.data}</span>
        {booking.expires_at && (
          <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> scade {fmtTime(booking.expires_at)}</span>
        )}
      </div>

      <div className="mt-1.5 text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
        {booking.telefono && (
          <a href={`tel:${booking.telefono}`} className="inline-flex items-center gap-1 text-primary hover:underline">
            <Phone className="w-3.5 h-3.5" /> {booking.telefono}
          </a>
        )}
        <a href={`mailto:${booking.email}`} className="inline-flex items-center gap-1 text-primary hover:underline">
          <Mail className="w-3.5 h-3.5" /> {booking.email}
        </a>
      </div>

      {canManage && (
        <div className="mt-3 pt-2 border-t border-border flex flex-wrap gap-2">
          {(booking.status === "pending" || booking.status === "manually_held") && (
            <button
              onClick={() => onCheckIn(booking.id)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-semibold rounded-xl bg-emerald-600 text-white h-9 hover:bg-emerald-700"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Check-in
            </button>
          )}
          {booking.status === "expired" && (
            <button
              onClick={() => onHoldManually(booking.id)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-semibold rounded-xl bg-amber-500 text-white h-9 hover:bg-amber-600"
            >
              <AlertTriangle className="w-3.5 h-3.5" /> Riserva comunque
            </button>
          )}
          <button
            onClick={() => onCancel(booking.id)}
            className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-semibold rounded-xl border border-border text-foreground h-9 hover:bg-secondary"
          >
            <Ban className="w-3.5 h-3.5" /> Cancella
          </button>
        </div>
      )}
    </div>
  );
}
