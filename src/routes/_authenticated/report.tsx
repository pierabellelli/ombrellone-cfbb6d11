import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
import { TrendingUp, ShoppingBag, Flame, Award, Timer, X } from "lucide-react";

type Stato = "arrivati" | "da_evadere" | "consegnati" | "annullato";
type Item = { id: string; nome_snapshot: string; prezzo_snapshot: number; quantita: number };
type Ordine = {
  id: string;
  numero_ordine: number;
  numero_ombrellone: string;
  fila: string | null;
  cognome: string;
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
    const isGestore = (roles ?? []).some((r) => r.role === "gestore" || r.role === "super_admin");
    const isStaff = (roles ?? []).some((r) => r.role === "staff");
    if (!isGestore && !isStaff) throw redirect({ to: "/ordini" });
    return { role: (isGestore ? "gestore" : "staff") as "gestore" | "staff", userId: u.user.id };
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
    .select("id, numero_ordine, numero_ombrellone, fila, cognome, totale, stato, archiviato, created_at, updated_at, ordine_items(id, nome_snapshot, prezzo_snapshot, quantita)")
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
  const { role, userId } = Route.useRouteContext();
  const [period, setPeriod] = useState<Period>("settimana");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [topN, setTopN] = useState<5 | 10>(10);
  const [drillProduct, setDrillProduct] = useState<string | null>(null);
  const [drillVisible, setDrillVisible] = useState(50);
  const [timeDrill, setTimeDrill] = useState<{ key: string; label: string; mode: "bucket" | "hourOfDay" } | null>(null);

  const { from, to, bucket } = useMemo(() => getRange(period, customFrom, customTo), [period, customFrom, customTo]);

  const { data: lidoId } = useQuery({ queryKey: ["report-lido-id"], queryFn: fetchUserLidoId, staleTime: 60_000 });

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["report-orders", lidoId, from.toISOString(), to.toISOString()],
    queryFn: () => loadOrdini(lidoId!, from, to),
    enabled: !!lidoId && role === "gestore",
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
    const ordersSeries = bucketLabels.map((b) => ({ key: b.key, label: b.label, value: ordersByBucket.get(b.key) ?? 0 }));

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

  const drillOrders = useMemo(() => {
    if (!drillProduct) return [];
    return orders
      .filter((o) => (o.ordine_items ?? []).some((it) => it.nome_snapshot === drillProduct))
      .map((o) => ({
        id: o.id,
        numero_ordine: o.numero_ordine,
        created_at: o.created_at,
        numero_ombrellone: o.numero_ombrellone,
        cognome: o.cognome,
        quantita: (o.ordine_items ?? []).filter((it) => it.nome_snapshot === drillProduct).reduce((s, it) => s + it.quantita, 0),
        totale: o.totale,
      }))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [orders, drillProduct]);

  const openDrill = (product: string) => {
    setDrillProduct(product);
    setDrillVisible(50);
  };

  const timeDrillOrders = useMemo(() => {
    if (!timeDrill) return [];
    return orders
      .filter((o) => {
        const created = new Date(o.created_at);
        return timeDrill.mode === "bucket"
          ? bucketKey(created, bucket) === timeDrill.key
          : format(created, "HH:00") === timeDrill.key;
      })
      .map((o) => ({
        id: o.id,
        numero_ordine: o.numero_ordine,
        created_at: o.created_at,
        numero_ombrellone: o.numero_ombrellone,
        fila: o.fila,
        cognome: o.cognome,
        items: o.ordine_items ?? [],
        totale: o.totale,
      }))
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [orders, timeDrill, bucket]);

  const openTimeDrill = (key: string, label: string, mode: "bucket" | "hourOfDay") => {
    setTimeDrill({ key, label, mode });
  };

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

      {role === "gestore" && (
      <>
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
                  <Bar
                    dataKey="value"
                    fill="var(--primary)"
                    radius={[4, 4, 0, 0]}
                    cursor="pointer"
                    onClick={(data: { key: string; label: string }) => openTimeDrill(data.key, data.label, "bucket")}
                  />
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
                  <Bar
                    dataKey="count"
                    radius={[4, 4, 0, 0]}
                    cursor="pointer"
                    onClick={(data: { hour: string }) => openTimeDrill(data.hour, data.hour, "hourOfDay")}
                  >
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
                      <Bar
                        dataKey="qty"
                        fill="var(--primary)"
                        radius={[0, 4, 4, 0]}
                        cursor="pointer"
                        onClick={(data: { name: string }) => openDrill(data.name)}
                      />
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
                      <tr
                        key={p.name}
                        onClick={() => openDrill(p.name)}
                        className="border-b border-border last:border-b-0 cursor-pointer hover:bg-secondary/60 transition"
                      >
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

      {drillProduct && (
        <ProductDrillModal
          product={drillProduct}
          orders={drillOrders}
          visible={drillVisible}
          onShowMore={() => setDrillVisible((v) => v + 50)}
          onClose={() => setDrillProduct(null)}
        />
      )}

      {timeDrill && (
        <OrdersTimeDrillModal
          label={timeDrill.label}
          orders={timeDrillOrders}
          onClose={() => setTimeDrill(null)}
        />
      )}
      </>
      )}

      {lidoId && (
        <StoricoOrdiniSection lidoId={lidoId} defaultFrom={from} defaultTo={to} role={role} userId={userId} />
      )}
    </div>
  );
}

type DrillOrder = {
  id: string;
  numero_ordine: number;
  created_at: string;
  numero_ombrellone: string;
  cognome: string;
  quantita: number;
  totale: number;
};

function ProductDrillModal({
  product, orders, visible, onShowMore, onClose,
}: {
  product: string;
  orders: DrillOrder[];
  visible: number;
  onShowMore: () => void;
  onClose: () => void;
}) {
  const shown = orders.slice(0, visible);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-start justify-between gap-3 p-4 border-b border-border shrink-0">
          <div>
            <div className="font-bold text-primary text-lg">{product}</div>
            <div className="text-sm text-muted-foreground">× {orders.length} ordinazioni</div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-4">
          {orders.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">Nessun ordine trovato</div>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-border">
                    <th className="py-1.5 pr-2">#Ordine</th>
                    <th className="py-1.5 pr-2">Data/ora</th>
                    <th className="py-1.5 pr-2">Ombrellone</th>
                    <th className="py-1.5 pr-2">Cognome</th>
                    <th className="py-1.5 pr-2 text-right">Quantità</th>
                    <th className="py-1.5 text-right">Totale ordine</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((o) => (
                    <tr key={o.id} className="border-b border-border last:border-b-0">
                      <td className="py-1.5 pr-2 font-medium">#{String(o.numero_ordine).padStart(3, "0")}</td>
                      <td className="py-1.5 pr-2 whitespace-nowrap">{format(new Date(o.created_at), "dd/MM/yyyy HH:mm")}</td>
                      <td className="py-1.5 pr-2">{o.numero_ombrellone}</td>
                      <td className="py-1.5 pr-2 truncate">{o.cognome}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">{o.quantita}</td>
                      <td className="py-1.5 text-right tabular-nums">€ {Number(o.totale).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {orders.length > visible && (
                <div className="mt-3 text-center">
                  <button
                    onClick={onShowMore}
                    className="px-4 py-2 rounded-full text-sm font-semibold border border-border hover:bg-secondary transition"
                  >
                    Mostra altri
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

type TimeDrillOrder = {
  id: string;
  numero_ordine: number;
  created_at: string;
  numero_ombrellone: string;
  fila: string | null;
  cognome: string;
  items: Item[];
  totale: number;
};

function OrdersTimeDrillModal({ label, orders, onClose }: { label: string; orders: TimeDrillOrder[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-start justify-between gap-3 p-4 border-b border-border shrink-0">
          <div className="font-bold text-primary text-lg">Ordini — {label}</div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-4">
          {orders.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">Nessun ordine in questo intervallo</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="py-1.5 pr-2">#Ordine</th>
                  <th className="py-1.5 pr-2">Ora</th>
                  <th className="py-1.5 pr-2">Ombrellone</th>
                  <th className="py-1.5 pr-2">Fila</th>
                  <th className="py-1.5 pr-2">Cognome</th>
                  <th className="py-1.5 pr-2">Prodotti</th>
                  <th className="py-1.5 text-right">Totale</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const itemsLabel = o.items.map((it) => `${it.quantita}× ${it.nome_snapshot}`).join(", ");
                  return (
                    <tr key={o.id} className="border-b border-border last:border-b-0">
                      <td className="py-1.5 pr-2 font-medium">#{String(o.numero_ordine).padStart(3, "0")}</td>
                      <td className="py-1.5 pr-2 whitespace-nowrap">{format(new Date(o.created_at), "dd/MM HH:mm")}</td>
                      <td className="py-1.5 pr-2">{o.numero_ombrellone}</td>
                      <td className="py-1.5 pr-2">{o.fila ?? "—"}</td>
                      <td className="py-1.5 pr-2 truncate">{o.cognome}</td>
                      <td className="py-1.5 pr-2 truncate max-w-[180px]" title={itemsLabel}>{itemsLabel || "—"}</td>
                      <td className="py-1.5 text-right tabular-nums">€ {Number(o.totale).toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
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

type StoricoStato = "" | "arrivati" | "da_evadere" | "consegnati" | "annullato";
type SortCol = "created_at" | "numero_ordine" | "numero_ombrellone" | "cognome" | "totale" | "stato";

type StoricoRow = {
  id: string;
  numero_ordine: number;
  created_at: string;
  numero_ombrellone: string;
  cognome: string;
  totale: number;
  stato: Stato;
  preso_in_carico_da: string | null;
  preso_in_carico_at: string | null;
  ordine_items: Item[];
};

// Canonical stato -> UI label mapping, used throughout this section
// (table pills and the filter dropdown).
const STATO_LABEL: Record<Stato, string> = {
  arrivati: "Nuovi",
  da_evadere: "In preparazione",
  consegnati: "Consegnati",
  annullato: "Annullato",
};

const STORICO_STATO_PILL: Record<Stato, string> = {
  arrivati: "bg-green-100 text-green-800",
  da_evadere: "bg-amber-100 text-amber-800",
  consegnati: "bg-emerald-100 text-emerald-800",
  annullato: "bg-red-100 text-red-800",
};

async function loadStorico(opts: {
  lidoId: string; from: Date; to: Date; ombrellone: string; stato: StoricoStato;
  sortCol: SortCol; sortAsc: boolean; page: number; presoInCaricoDa: string | null;
}): Promise<{ rows: StoricoRow[]; count: number }> {
  let q = supabase
    .from("ordini")
    .select(
      "id, numero_ordine, numero_ombrellone, cognome, totale, stato, created_at, preso_in_carico_da, preso_in_carico_at, ordine_items(id, nome_snapshot, prezzo_snapshot, quantita)",
      { count: "exact" },
    )
    .eq("lido_id", opts.lidoId)
    .gte("created_at", opts.from.toISOString())
    .lte("created_at", opts.to.toISOString());
  if (opts.ombrellone.trim()) q = q.ilike("numero_ombrellone", `%${opts.ombrellone.trim()}%`);
  if (opts.stato !== "") q = q.eq("stato", opts.stato);
  if (opts.presoInCaricoDa) q = q.eq("preso_in_carico_da", opts.presoInCaricoDa);
  q = q.order(opts.sortCol, { ascending: opts.sortAsc }).range(opts.page * 25, (opts.page + 1) * 25 - 1);
  const { data, error, count } = await q;
  if (error) throw error;
  return { rows: (data ?? []) as unknown as StoricoRow[], count: count ?? 0 };
}

async function loadStoricoStaffGlobale(lidoId: string): Promise<boolean> {
  const { data, error } = await (supabase.from("lidi") as any).select("storico_staff_globale").eq("id", lidoId).maybeSingle();
  if (error) throw error;
  return !!(data as any)?.storico_staff_globale;
}

async function loadUserEmails(userIds: string[]): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();
  const { data, error } = await (supabase.rpc as any)("get_user_emails", { _user_ids: userIds });
  if (error) return new Map();
  return new Map(((data ?? []) as any[]).map((u: any) => [u.id, u.email]));
}

function StoricoOrdiniSection({
  lidoId, defaultFrom, defaultTo, role, userId,
}: {
  lidoId: string; defaultFrom: Date; defaultTo: Date; role: "gestore" | "staff"; userId: string;
}) {
  const [localFrom, setLocalFrom] = useState(format(defaultFrom, "yyyy-MM-dd"));
  const [localTo, setLocalTo] = useState(format(defaultTo, "yyyy-MM-dd"));
  const [ombrelloneInput, setOmbrelloneInput] = useState("");
  const [ombrelloneFilter, setOmbrelloneFilter] = useState("");
  const [stato, setStato] = useState<StoricoStato>("");
  const [sortCol, setSortCol] = useState<SortCol>("created_at");
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(0);

  useEffect(() => {
    setLocalFrom(format(defaultFrom, "yyyy-MM-dd"));
    setLocalTo(format(defaultTo, "yyyy-MM-dd"));
    setPage(0);
  }, [defaultFrom, defaultTo]);

  useEffect(() => {
    const id = setTimeout(() => {
      setOmbrelloneFilter(ombrelloneInput);
      setPage(0);
    }, 300);
    return () => clearTimeout(id);
  }, [ombrelloneInput]);

  const fromDate = useMemo(() => startOfDay(new Date(localFrom)), [localFrom]);
  const toDate = useMemo(() => endOfDay(new Date(localTo)), [localTo]);

  const { data: storicoStaffGlobale = false } = useQuery({
    queryKey: ["report-storico-globale", lidoId],
    queryFn: () => loadStoricoStaffGlobale(lidoId),
    enabled: role === "staff",
  });

  const presoInCaricoDa = role === "staff" && !storicoStaffGlobale ? userId : null;

  const { data, isLoading } = useQuery({
    queryKey: ["report-storico", lidoId, localFrom, localTo, ombrelloneFilter, stato, sortCol, sortAsc, page, presoInCaricoDa],
    queryFn: () => loadStorico({ lidoId, from: fromDate, to: toDate, ombrellone: ombrelloneFilter, stato, sortCol, sortAsc, page, presoInCaricoDa }),
    enabled: !!lidoId,
  });

  const rows = data?.rows ?? [];
  const count = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(count / 25));

  const staffIds = useMemo(
    () => [...new Set(rows.map((r) => r.preso_in_carico_da).filter((id): id is string => !!id))],
    [rows],
  );
  const { data: staffEmails = new Map<string, string>() } = useQuery({
    queryKey: ["report-storico-emails", staffIds],
    queryFn: () => loadUserEmails(staffIds),
    enabled: role === "gestore" && staffIds.length > 0,
  });

  const toggleSort = (col: SortCol) => {
    if (sortCol === col) setSortAsc((a) => !a);
    else { setSortCol(col); setSortAsc(false); }
    setPage(0);
  };

  const clearFilters = () => {
    setOmbrelloneInput("");
    setOmbrelloneFilter("");
    setStato("");
    setLocalFrom(format(defaultFrom, "yyyy-MM-dd"));
    setLocalTo(format(defaultTo, "yyyy-MM-dd"));
    setPage(0);
  };

  const sortIndicator = (col: SortCol) => (sortCol === col ? (sortAsc ? "▲" : "▼") : "");

  const sectionLabel = role === "gestore"
    ? "Tutti gli ordini del lido"
    : storicoStaffGlobale ? "Tutti gli ordini del lido" : "I tuoi ordini";

  const colCount = role === "gestore" ? 8 : 7;

  return (
    <div className="mt-6 card-soft p-4">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
        <h2 className="text-lg font-bold text-primary">Storico ordini</h2>
        <span className="text-sm text-muted-foreground">Totale: {count} ordini</span>
      </div>
      <p className="text-xs text-muted-foreground mb-3">{sectionLabel}</p>

      <div className="flex flex-wrap items-center gap-3 mb-3 pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={localFrom}
            onChange={(e) => { setLocalFrom(e.target.value); setPage(0); }}
            className="px-2.5 py-1.5 rounded-lg border border-border bg-card text-sm"
          />
          <span className="text-muted-foreground text-sm">→</span>
          <input
            type="date"
            value={localTo}
            onChange={(e) => { setLocalTo(e.target.value); setPage(0); }}
            className="px-2.5 py-1.5 rounded-lg border border-border bg-card text-sm"
          />
        </div>
        <input
          value={ombrelloneInput}
          onChange={(e) => setOmbrelloneInput(e.target.value)}
          placeholder="Numero ombrellone"
          className="px-2.5 py-1.5 rounded-lg border border-border bg-card text-sm w-36"
        />
        <select
          value={stato}
          onChange={(e) => { setStato(e.target.value as StoricoStato); setPage(0); }}
          className="px-2.5 py-1.5 rounded-lg border border-border bg-card text-sm"
        >
          <option value="">Tutti</option>
          <option value="arrivati">Nuovi</option>
          <option value="da_evadere">In preparazione</option>
          <option value="consegnati">Consegnati</option>
          <option value="annullato">Annullati</option>
        </select>
        <button
          onClick={clearFilters}
          className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg border border-border hover:bg-secondary transition"
        >
          <X className="w-3.5 h-3.5" /> Pulisci filtri
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="text-left text-xs text-muted-foreground border-b border-border">
              <th className="py-1.5 pr-2 cursor-pointer whitespace-nowrap" onClick={() => toggleSort("numero_ordine")}>#Ordine {sortIndicator("numero_ordine")}</th>
              <th className="py-1.5 pr-2 cursor-pointer whitespace-nowrap" onClick={() => toggleSort("created_at")}>Data/ora {sortIndicator("created_at")}</th>
              <th className="py-1.5 pr-2 cursor-pointer whitespace-nowrap" onClick={() => toggleSort("numero_ombrellone")}>Ombrellone {sortIndicator("numero_ombrellone")}</th>
              <th className="py-1.5 pr-2 cursor-pointer whitespace-nowrap" onClick={() => toggleSort("cognome")}>Cognome {sortIndicator("cognome")}</th>
              <th className="py-1.5 pr-2">Prodotti</th>
              <th className="py-1.5 pr-2 text-right cursor-pointer whitespace-nowrap" onClick={() => toggleSort("totale")}>Totale {sortIndicator("totale")}</th>
              <th className="py-1.5 pr-2 cursor-pointer whitespace-nowrap" onClick={() => toggleSort("stato")}>Stato {sortIndicator("stato")}</th>
              <th className="py-1.5 pr-2 whitespace-nowrap">Preso in carico alle</th>
              {role === "gestore" && <th className="py-1.5 whitespace-nowrap">Gestito da</th>}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={colCount + 1} className="py-6 text-center text-muted-foreground">Caricamento…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={colCount + 1} className="py-6 text-center text-muted-foreground">Nessun ordine trovato</td></tr>
            ) : (
              rows.map((o) => {
                const itemsLabel = (o.ordine_items ?? []).map((it) => `${it.quantita}× ${it.nome_snapshot}`).join(", ");
                return (
                  <tr key={o.id} className="border-b border-border last:border-b-0">
                    <td className="py-1.5 pr-2 font-medium whitespace-nowrap">#{String(o.numero_ordine).padStart(3, "0")}</td>
                    <td className="py-1.5 pr-2 whitespace-nowrap">{format(new Date(o.created_at), "dd/MM/yyyy HH:mm")}</td>
                    <td className="py-1.5 pr-2">{o.numero_ombrellone}</td>
                    <td className="py-1.5 pr-2 truncate max-w-[120px]">{o.cognome}</td>
                    <td className="py-1.5 pr-2 truncate max-w-[200px]" title={itemsLabel}>{itemsLabel || "—"}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums whitespace-nowrap">€ {Number(o.totale).toFixed(2)}</td>
                    <td className="py-1.5 pr-2">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${STORICO_STATO_PILL[o.stato]}`}>
                        {STATO_LABEL[o.stato]}
                      </span>
                    </td>
                    <td className="py-1.5 pr-2 whitespace-nowrap">
                      {o.preso_in_carico_at ? format(new Date(o.preso_in_carico_at), "dd/MM HH:mm") : "—"}
                    </td>
                    {role === "gestore" && (
                      <td className="py-1.5 whitespace-nowrap text-xs">
                        {o.preso_in_carico_da ? (staffEmails.get(o.preso_in_carico_da) ?? "—") : "—"}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Pagina {page + 1} di {totalPages}</span>
        <div className="flex gap-2">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1.5 rounded-lg text-sm border border-border disabled:opacity-40 hover:bg-secondary transition"
          >
            Precedente
          </button>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={(page + 1) * 25 >= count}
            className="px-3 py-1.5 rounded-lg text-sm border border-border disabled:opacity-40 hover:bg-secondary transition"
          >
            Successiva
          </button>
        </div>
      </div>
    </div>
  );
}
