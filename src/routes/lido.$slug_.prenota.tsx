import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Loader2, AlertTriangle, CheckCircle2, CalendarDays, Umbrella } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";

export const Route = createFileRoute("/lido/$slug_/prenota")({
  head: ({ params }) => ({
    meta: [
      { title: `Prenota · ${params.slug} · OmbrellOne` },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1" },
    ],
  }),
  component: PrenotaPage,
});

type Lido = {
  id: string;
  nome: string;
  slug: string;
  logo_url: string | null;
  booking_module_enabled: boolean;
  max_booking_days_ahead: number;
};

type Fila = { index: number; label: string; ombrelloni: { numero: number }[] };
type BookedSpot = { fila: string; numero_ombrellone: string };
type Selection = { fila: string; numero: number } | null;

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isValidPhoneDigits(prefix: string, digits: string): boolean {
  if (!digits || !/^\d+$/.test(digits)) return false;
  if (prefix === "+39") return digits.length >= 9 && digits.length <= 10 && digits[0] === "3";
  return digits.length >= 6 && digits.length <= 15;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function PrenotaPage() {
  const { slug } = Route.useParams();

  const { data: lido, isLoading: lidoLoading, error: lidoErr } = useQuery({
    queryKey: ["pub-booking-lido", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lidi")
        .select("id, nome, slug, logo_url, booking_module_enabled, max_booking_days_ahead")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data as Lido | null;
    },
  });

  const { data: layout } = useQuery({
    queryKey: ["pub-booking-layout", lido?.id],
    enabled: !!lido?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_public_beach_layout", { _lido_id: lido!.id });
      if (error) throw error;
      return (data ?? []) as unknown as Fila[];
    },
  });

  const [pickedDates, setPickedDates] = useState<Date[]>([]);
  const [selections, setSelections] = useState<Record<string, Selection>>({});
  const [confirmed, setConfirmed] = useState<{ fila: string; numero: string; data: string; expiresAt: string | null }[] | null>(null);

  const maxDays = lido?.max_booking_days_ahead ?? 0;
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const maxDate = useMemo(() => { const d = new Date(today); d.setDate(d.getDate() + maxDays); return d; }, [today, maxDays]);

  const selectedDates = useMemo(
    () => [...pickedDates].map(isoDate).sort(),
    [pickedDates],
  );

  const bookedQueries = useQueries({
    queries: selectedDates.map((data) => ({
      queryKey: ["pub-booked-spots", lido?.id, data],
      enabled: !!lido?.id,
      queryFn: async () => {
        const { data: rows, error } = await supabase.rpc("get_booked_spots", { _lido_id: lido!.id, _data: data });
        if (error) throw error;
        return (rows ?? []) as BookedSpot[];
      },
    })),
  });

  const bookedByDate = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    selectedDates.forEach((data, i) => {
      const rows = bookedQueries[i]?.data ?? [];
      map[data] = new Set(rows.map((r) => `${r.fila}|${r.numero_ombrellone}`));
    });
    return map;
  }, [selectedDates, bookedQueries]);

  const selectSpot = (data: string, fila: string, numero: number) => {
    setSelections((prev) => {
      const current = prev[data];
      if (current && current.fila === fila && current.numero === numero) {
        return { ...prev, [data]: null };
      }
      return { ...prev, [data]: { fila, numero } };
    });
  };

  const [nome, setNome] = useState("");
  const [cognome, setCognome] = useState("");
  const [email, setEmail] = useState("");
  const [prefix, setPrefix] = useState("+39");
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);

  const allDatesHaveSpot = selectedDates.length > 0 && selectedDates.every((d) => !!selections[d]);

  const handleSubmit = async () => {
    if (!lido) return;
    if (!nome.trim()) { toast.error("Inserisci il nome"); return; }
    if (!cognome.trim()) { toast.error("Inserisci il cognome"); return; }
    if (!isValidEmail(email.trim())) { toast.error("Email non valida"); return; }
    const digits = phone.replace(/[\s-]/g, "");
    if (!isValidPhoneDigits(prefix, digits)) { toast.error("Numero di telefono non valido"); return; }
    if (!allDatesHaveSpot) { toast.error("Seleziona un ombrellone per ogni data scelta"); return; }

    const slots = selectedDates.map((data) => ({
      fila: selections[data]!.fila,
      numero_ombrellone: String(selections[data]!.numero),
      data,
    }));

    setSending(true);
    const { data: rows, error } = await supabase.rpc("create_booking", {
      _lido_id: lido.id,
      _nome: nome.trim().slice(0, 60),
      _cognome: cognome.trim().slice(0, 60),
      _email: email.trim().slice(0, 120),
      _telefono: `${prefix}${digits}`.slice(0, 30),
      _slots: slots,
    });
    setSending(false);

    if (error) {
      toast.error("Prenotazione non riuscita", { description: error.message });
      return;
    }

    setConfirmed((rows ?? []).map((r: any) => ({ fila: r.fila, numero: r.numero_ombrellone, data: r.data, expiresAt: r.expires_at })));
  };

  if (lidoLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Caricamento...
      </div>
    );
  }

  if (lidoErr || !lido) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="card-soft p-6 max-w-md text-center">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-2" />
          <h1 className="text-xl font-semibold text-primary">Stabilimento non trovato</h1>
        </div>
      </div>
    );
  }

  if (!lido.booking_module_enabled) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="card-soft p-6 max-w-md text-center">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-2" />
          <h1 className="text-xl font-semibold text-primary">Prenotazioni non disponibili</h1>
          <p className="text-sm text-muted-foreground mt-2">
            {lido.nome} non accetta prenotazioni online al momento.
          </p>
        </div>
      </div>
    );
  }

  if (confirmed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[color:var(--background)]">
        <div className="card-soft p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-[color:var(--teal)]/20 text-[color:var(--teal-deep)] flex items-center justify-center mb-3">
            <CheckCircle2 className="w-9 h-9" />
          </div>
          <h1 className="text-2xl font-bold text-primary">Prenotazione confermata</h1>
          <p className="text-muted-foreground mt-1">Ti aspettiamo a {lido.nome}.</p>
          <div className="mt-6 space-y-2 text-left">
            {confirmed.map((c, i) => (
              <div key={i} className="rounded-xl bg-secondary p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{c.data}</span>
                  <span className="text-muted-foreground">{c.fila} · Ombrellone {c.numero}</span>
                </div>
                {!c.expiresAt && (
                  <div className="mt-1 text-xs font-medium text-[color:var(--teal-deep)]">
                    Prenotazione immediata: ti aspettiamo oggi, nessuna scadenza.
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[color:var(--background)] pb-24">
      <header className="sticky top-0 z-20 bg-card/95 backdrop-blur border-b border-border">
        <div className="max-w-2xl mx-auto px-3 h-12 flex items-center gap-2">
          <button
            type="button"
            onClick={() => { if (window.history.length > 1) window.history.back(); else window.location.href = "/"; }}
            aria-label="Indietro"
            className="w-9 h-9 -ml-1 inline-flex items-center justify-center rounded-full hover:bg-secondary transition"
          >
            <ArrowLeft className="w-5 h-5 text-primary" />
          </button>
          <div className="flex-1 min-w-0 flex items-center justify-center gap-2">
            {lido.logo_url && <img src={lido.logo_url} alt={lido.nome} className="w-6 h-6 rounded-full object-cover" />}
            <span className="text-sm font-semibold text-primary truncate">{lido.nome} · Prenota</span>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-6">
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wider text-primary mb-2 inline-flex items-center gap-1.5">
            <CalendarDays className="w-4 h-4" /> Scegli una o più date
          </h2>
          <div className="card-soft p-2 flex justify-center">
            <Calendar
              mode="multiple"
              selected={pickedDates}
              onSelect={(dates) => setPickedDates(dates ?? [])}
              disabled={{ before: today, after: maxDate }}
              defaultMonth={today}
            />
          </div>
        </section>

        {selectedDates.map((data) => (
          <DateAvailability
            key={data}
            data={data}
            layout={layout ?? []}
            booked={bookedByDate[data] ?? new Set()}
            selection={selections[data] ?? null}
            onSelect={(fila, numero) => selectSpot(data, fila, numero)}
          />
        ))}

        {selectedDates.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-primary">I tuoi dati</h2>
            <div>
              <Label htmlFor="p-nome">Nome</Label>
              <Input id="p-nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={60} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="p-cognome">Cognome</Label>
              <Input id="p-cognome" value={cognome} onChange={(e) => setCognome(e.target.value)} maxLength={60} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="p-email">Email</Label>
              <Input id="p-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={120} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="p-tel">Telefono</Label>
              <div className="mt-1.5 flex gap-2">
                <select value={prefix} onChange={(e) => setPrefix(e.target.value)} className="px-2 py-2 rounded-lg border border-border bg-card text-sm shrink-0">
                  <option value="+39">🇮🇹 +39</option>
                  <option value="+44">🇬🇧 +44</option>
                  <option value="+49">🇩🇪 +49</option>
                  <option value="+33">🇫🇷 +33</option>
                </select>
                <Input id="p-tel" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="flex-1" />
              </div>
            </div>

            <Button onClick={handleSubmit} disabled={sending || !allDatesHaveSpot} className="w-full h-12 text-base rounded-full">
              {sending ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : null}
              Conferma prenotazione
            </Button>
            {!allDatesHaveSpot && (
              <p className="text-xs text-muted-foreground text-center">Seleziona un ombrellone per ogni data scelta.</p>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

function DateAvailability({ data, layout, booked, selection, onSelect }: {
  data: string;
  layout: Fila[];
  booked: Set<string>;
  selection: Selection;
  onSelect: (fila: string, numero: number) => void;
}) {
  if (layout.length === 0) {
    return (
      <section>
        <h3 className="text-sm font-semibold text-foreground mb-2">{data}</h3>
        <div className="card-soft p-4 text-center text-sm text-muted-foreground">Mappa non disponibile</div>
      </section>
    );
  }
  return (
    <section>
      <h3 className="text-sm font-semibold text-foreground mb-2">{data}</h3>
      <div className="card-soft p-3 space-y-3">
        {layout.map((row) => (
          <div key={row.index}>
            <div className="text-xs font-semibold text-muted-foreground mb-1.5 px-1">{row.label}</div>
            <div className="flex flex-wrap gap-2">
              {row.ombrelloni.map((u) => {
                const key = `${row.label}|${u.numero}`;
                const isBooked = booked.has(key);
                const isSelected = selection?.fila === row.label && selection?.numero === u.numero;
                return (
                  <button
                    key={key}
                    disabled={isBooked}
                    onClick={() => onSelect(row.label, u.numero)}
                    className={`w-12 h-12 rounded-xl border-2 flex flex-col items-center justify-center text-xs font-bold transition ${
                      isBooked
                        ? "bg-gray-200 border-gray-300 text-gray-400 cursor-not-allowed"
                        : isSelected
                        ? "bg-primary border-primary text-primary-foreground"
                        : "bg-white border-gray-300 text-foreground hover:border-primary"
                    }`}
                  >
                    <Umbrella className="w-3.5 h-3.5" />
                    {u.numero}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
