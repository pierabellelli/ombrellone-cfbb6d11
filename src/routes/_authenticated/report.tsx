import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  startOfDay, endOfDay, startOfWeek, startOfMonth,
  eachDayOfInterval, differenceInCalendarDays, differenceInMinutes, format,
} from "date-fns";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import { TrendingUp, ShoppingBag, Flame, Award, Timer } from "lucide-react";

type Stato = "arrivati" | "da_evadere" | "consegnati" | "annullato";
type Item = { id: string; nome_snapshot: string; prezzo_snapshot: number; quantita: number };
type Ordine = {
  id: string;
  numero_ordine: number;
  totale: number;
  stato: Stato;
  archiviato: boolean;
  created_at: string;
  updated_at: string;
  ordine_items: Item[];
};

type Period = "oggi" | "settimana" | "mese" | "personalizzato";
type Bucket = "hour" | "day";

export const Route = createFileRoute("/_authenticated/report")({
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/login" });
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", u.user.id);
    const isGestore = (roles ?? []).some((r) => r.role === "gestore");
    if (!isGestore) throw redirect({ to: "/ordini" });
  },
  head: () => ({ meta: [{ title: "Report · OmbrellOne" }] }),
  component: ReportPage,
});

async function fetchUserLidoId(): Promise<string | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const { data, error } = await supabase.rpc("user_lido_id");
  if (error) return null;
  return (data as string | null) ?? null;
}

async function loadOrdini(lidoId: string, from: Date, to: Date): Promise<Ordine[]> {
  const { data, error } = await supabase
    .from("ordini")
    .select("id, numero_ordine, totale, stato, archiviato, created_at, updated_at, ordine_items(id, nome_snapshot, prezzo_snapshot, quantita)")
    .eq("lido_id", lidoId)
    .gte("created_at", from.toISOString())
    .lte("created_at", to.toISOString())
    .neq("stato", "annullato")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as Ordine[];
}

function getRange(period: Period, customFrom: string, customTo: string): { from: Date; to: Date; bucket: Bucket } {
  const now = new Date();
  if (period === "oggi") return { from: startOfDay(now), to: now, bucket: "hour" };
  if (period === "settimana") return { from: startOfWeek(now, { weekStartsOn: 1 }), to: now, bucket: "day" };
  if (period === "mese") return { from: startOfMonth(now), to: now, bucket: "day" };
  const from = customFrom ? startOfDay(new Date(customFrom)) : startOfDay(now);
  const to = customTo ? endOfDay(new Date(customTo)) : now;
  const spanDays = differenceInCalendarDays(to, from);
  return { from, to, bucket: spanDays <= 1 ? "hour" : "day" };
}

function bucketKey(d: Date, bucket: Bucket): string {
  return bucket === "hour" ? format(d, "HH:00") : format(d, "yyyy-MM-dd");
}

function buildBucketLabels(from: Date, to: Date, bucket: Bucket): { key: string; label: string }[] {
  if (bucket === "hour") {
    return Array.from({ length: 24 }, (_, h) => ({
      key: `${String(h).padStart(2, "0")}:00`,
      label: `${String(h).padStart(2, "0")}:00`,
    }));
  }
  return eachDayOfInterval({ start: from, end: to }).map((d) => ({
    key: format(d, "yyyy-MM-dd"),
    label: format(d, "dd/MM"),
  }));
}

function ReportPage() {
  const [period, setPeriod] = useState<Period>("settimana");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [topN, setTopN] = useState<5 | 10>(10);

  const { from, to, bucket } = useMemo(() => getRange(period, customFrom, customTo), [period, customFrom, customTo]);

  const { data: lidoId } = useQuery({ queryKey: ["report-lido-id"], queryFn: fetchUserLidoId, staleTime: 60_000 });

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["report-orders", lidoId, from.toISOString(), to.toISOString()],
    queryFn: () => loadOrdini(lidoId!, from, to),
    enabled: !!lidoId,
  });

  const metrics = useMemo(() => {
    const bucketLabels = buildBucketLabels(from, to, bucket);
    const revenueByBucket = new Map(bucketLabels.map((b) => [b.key, 0]));
    const ordersByBucket = new Map(bucketLabels.map((b) => [b.key, 0]));
    const ordersByHour = Array.from({ length: 24 }, () => 0);

    let totalRevenue = 0;
    const deliveryMinutes: number[] = [];

    for (const o of orders) {
      const created = new Date(o.created_at);
      const key = bucketKey(created, bucket);
      ordersByBucket.set(key, (ordersByBucket.get(key) ?? 0) + 1);
      ordersByHour[created.getHours()] += 1;

      if (o.stato === "consegnati") {
        totalRevenue += Number(o.totale);
        revenueByBucket.set(key, (revenueByBucket.get(key) ?? 0) + Number(o.totale));
        const mins = differenceInMinutes(new Date(o.updated_at), created);
        if (mins >= 0) deliveryMinutes.push(mins);
      }
    }

    const revenueSeries = bucketLabels.map((b) => ({ label: b.label, value: Math.round((revenueByBucket.get(b.key) ?? 0) * 100) / 100 }));
    const ordersSeries = bucketLabels.map((b) => ({ label: b.label, value: ordersByBucket.get(b.key) ?? 0 }));

    const hourSeries = ordersByHour.map((count, h) => ({ hour: `${String(h).padStart(2, "0")}:00`, count }));
    const top3Hours = [...hourSeries]
      .sort((a, b) => b.count - a.count)
      .filter((h) => h.count > 0)
      .slice(0, 3)
      .map((h) => h.hour);

    const productMap = new Map<string, { qty: number; revenue: number }>();
    for (const o of orders) {
      for (const it of o.ordine_items ?? []) {
        const cur = productMap.get(it.nome_snapshot) ?? { qty: 0, revenue: 0 };
        cur.qty += it.quantita;
        cur.revenue += it.prezzo_snapshot * it.quantita;
        productMap.set(it.nome_snapshot, cur);
      }
    }
    const products = [...productMap.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.qty - a.qty);

    const avgDeliveryMin = deliveryMinutes.length
      ? Math.round(deliveryMinutes.reduce((s, m) => s + m, 0) / deliveryMinutes.length)
      : 0;
    const buckets = [
      { label: "0-5", min: 0, max: 5 },
      { label: "5-10", min: 5, max: 10 },
      { label: "10-15", min: 10, max: 15 },
      { label: "15-20", min: 15, max: 20 },
      { label: "20+", min: 20, max: Infinity },
    ];
    const deliveryDistribution = buckets.map((b) => ({
      label: b.label,
      count: deliveryMinutes.filter((m) => m >= b.min && m < b.max).length,
    }));

    return {
      totalRevenue,
      totalOrders: orders.length,
      revenueSeries,
      ordersSeries,
      hourSeries,
      top3Hours,
      products,
      avgDeliveryMin,
      deliveryDistribution,
      deliverySamples: deliveryMinutes.length,
    };
  }, [orders, from, to, bucket]);

  return (
    <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-6">
      <div className="mb-5">
        <h1 className="text-2xl md:text-3xl font-bold text-primary">Report</h1>
        <p className="text-sm text-muted-foreground mt-1">Statistiche e andamento del lido.</p>
      </div>

      <FilterBar
        period={period}
        onPeriod={setPeriod}
        customFrom={customFrom}
        customTo={customTo}
        onCustomFrom={setCustomFrom}
        onCustomTo={setCustomTo}
      />

      {isLoading ? (
        <div className="mt-10 text-center text-muted-foreground text-sm">Caricamento dati…</div>
      ) : (
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card title="Incasso" icon={<TrendingUp className="w-4 h-4" />}>
            <div className="text-3xl font-bold text-primary">€ {metrics.totalRevenue.toFixed(2)}</div>
            <div className="mt-3 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metrics.revenueSeries}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={40} />
                  <Tooltip formatter={(v: number) => [`€ ${v.toFixed(2)}`, "Incasso"]} />
                  <Line type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="Ordini" icon={<ShoppingBag className="w-4 h-4" />}>
            <div className="text-3xl font-bold text-primary">{metrics.totalOrders}</div>
            <div className="mt-3 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.ordersSeries}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={30} allowDecimals={false} />
                  <Tooltip formatter={(v: number) => [v, "Ordini"]} />
                  <Bar dataKey="value" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="Ore di punta" icon={<Flame className="w-4 h-4" />}>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.hourSeries}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={1} />
                  <YAxis tick={{ fontSize: 11 }} width={30} allowDecimals={false} />
                  <Tooltip formatter={(v: number) => [v, "Ordini"]} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {metrics.hourSeries.map((h, i) => (
                      <Cell
                        key={i}
                        fill={
                          metrics.top3Hours[0] === h.hour ? "#dc2626"
                          : metrics.top3Hours.includes(h.hour) ? "#f59e0b"
                          : "var(--primary)"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card
            title="Prodotti più venduti"
            icon={<Award className="w-4 h-4" />}
            action={
              <div className="inline-flex rounded-full border border-border bg-card p-0.5 text-xs font-semibold">
                <button
                  onClick={() => setTopN(5)}
                  className={`px-2.5 py-1 rounded-full transition ${topN === 5 ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                >Top 5</button>
                <button
                  onClick={() => setTopN(10)}
                  className={`px-2.5 py-1 rounded-full transition ${topN === 10 ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                >Top 10</button>
              </div>
            }
          >
            {metrics.products.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">Nessun prodotto venduto nel periodo.</div>
            ) : (
              <>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={metrics.products.slice(0, topN)} layout="vertical" margin={{ left: 12 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
                      <Tooltip formatter={(v: number) => [v, "Quantità"]} />
                      <Bar dataKey="qty" fill="var(--primary)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <table className="mt-3 w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b border-border">
                      <th className="py-1.5 pr-2 w-8">#</th>
                      <th className="py-1.5 pr-2">Prodotto</th>
                      <th className="py-1.5 pr-2 text-right">Qtà</th>
                      <th className="py-1.5 text-right">Incasso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.products.slice(0, topN).map((p, i) => (
                      <tr key={p.name} className="border-b border-border last:border-b-0">
                        <td className="py-1.5 pr-2 text-muted-foreground">{i + 1}</td>
                        <td className="py-1.5 pr-2 truncate">{p.name}</td>
                        <td className="py-1.5 pr-2 text-right tabular-nums">{p.qty}</td>
                        <td className="py-1.5 text-right tabular-nums">€ {p.revenue.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </Card>

          <Card title="Tempo medio di consegna" icon={<Timer className="w-4 h-4" />}>
            <div className="text-3xl font-bold text-primary">
              {metrics.deliverySamples > 0 ? `${metrics.avgDeliveryMin} min` : "—"}
            </div>
            {metrics.deliverySamples === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">Nessun ordine consegnato nel periodo.</div>
            ) : (
              <div className="mt-3 h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics.deliveryDistribution}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} width={30} allowDecimals={false} />
                    <Tooltip formatter={(v: number) => [v, "Ordini"]} />
                    <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

function FilterBar({
  period, onPeriod, customFrom, customTo, onCustomFrom, onCustomTo,
}: {
  period: Period;
  onPeriod: (p: Period) => void;
  customFrom: string;
  customTo: string;
  onCustomFrom: (v: string) => void;
  onCustomTo: (v: string) => void;
}) {
  const options: { value: Period; label: string }[] = [
    { value: "oggi", label: "Oggi" },
    { value: "settimana", label: "Settimana" },
    { value: "mese", label: "Mese" },
    { value: "personalizzato", label: "Personalizzato" },
  ];
  return (
    <div className="card-soft p-3 flex flex-wrap items-center gap-3">
      <div className="inline-flex rounded-full border border-border bg-card p-0.5 text-sm font-medium flex-wrap">
        {options.map((o) => (
          <button
            key={o.value}
            onClick={() => onPeriod(o.value)}
            className={`px-3 py-1.5 rounded-full transition ${period === o.value ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {period === "personalizzato" && (
        <div className="flex items-center gap-2 text-sm">
          <input
            type="date"
            value={customFrom}
            onChange={(e) => onCustomFrom(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-border bg-card text-sm"
          />
          <span className="text-muted-foreground">→</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => onCustomTo(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-border bg-card text-sm"
          />
        </div>
      )}
    </div>
  );
}

function Card({ title, icon, action, children }: { title: string; icon: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card-soft p-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
          {icon} {title}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}
