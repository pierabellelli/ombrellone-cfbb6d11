import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, endOfDay, startOfWeek, startOfMonth, eachDayOfInterval, format, formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import {
  ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip,
} from "recharts";
import {
  TrendingUp, ShoppingBag, Store, CircleCheck, ExternalLink, UserPlus, LayoutDashboard, ArrowLeft,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/dashboard")({
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/login" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
    const isSuperAdmin = (roles ?? []).some((r) => r.role === "super_admin");
    if (!isSuperAdmin) throw redirect({ to: "/ordini" });
  },
  head: () => ({ meta: [{ title: "Dashboard admin · OmbrellOne" }] }),
  component: AdminDashboardPage,
});

type Periodo = "oggi" | "settimana" | "mese";

type Lido = { id: string; nome: string; slug: string; attivo: boolean; in_pausa: boolean };
type OrdineRow = { id: string; lido_id: string; totale: number; stato: string; created_at: string };

function periodoRange(periodo: Periodo): { from: Date; to: Date } {
  const now = new Date();
  if (periodo === "oggi") return { from: startOfDay(now), to: endOfDay(now) };
  if (periodo === "settimana") return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfDay(now) };
  return { from: startOfMonth(now), to: endOfDay(now) };
}

async function loadLidi(): Promise<Lido[]> {
  const { data, error } = await supabase.from("lidi").select("id, nome, slug, attivo, in_pausa").order("nome");
  if (error) throw error;
  return (data ?? []) as Lido[];
}

async function loadOrdini(from: Date, to: Date): Promise<OrdineRow[]> {
  const { data, error } = await supabase
    .from("ordini")
    .select("id, lido_id, totale, stato, created_at")
    .gte("created_at", from.toISOString())
    .lte("created_at", to.toISOString())
    .neq("stato", "annullato");
  if (error) throw error;
  return (data ?? []) as OrdineRow[];
}

async function loadUltimoAccesso(): Promise<Map<string, string | null>> {
  const { data, error } = await (supabase.rpc as any)("admin_lidi_last_access");
  if (error) throw error;
  const map = new Map<string, string | null>();
  for (const row of (data ?? []) as { lido_id: string; last_sign_in_at: string | null }[]) {
    map.set(row.lido_id, row.last_sign_in_at);
  }
  return map;
}

function AdminDashboardPage() {
  const [periodo, setPeriodo] = useState<Periodo>("settimana");
  const { from, to } = periodoRange(periodo);

  const { data: lidi = [], isLoading: lidiLoading } = useQuery({
    queryKey: ["admin-dashboard-lidi"],
    queryFn: loadLidi,
  });

  const { data: ordini = [], isLoading: ordiniLoading } = useQuery({
    queryKey: ["admin-dashboard-ordini", periodo],
    queryFn: () => loadOrdini(from, to),
  });

  const { data: ultimoAccesso = new Map<string, string | null>(), isLoading: accessoLoading } = useQuery({
    queryKey: ["admin-dashboard-ultimo-accesso"],
    queryFn: loadUltimoAccesso,
  });

  const isLoading = lidiLoading || ordiniLoading || accessoLoading;

  const metrics = useMemo(() => {
    const consegnati = ordini.filter((o) => o.stato === "consegnati");
    const totalRevenue = consegnati.reduce((s, o) => s + Number(o.totale), 0);
    const totalOrders = ordini.length;
    const lidiAttivi = lidi.filter((l) => l.attivo).length;

    const days = eachDayOfInterval({ start: from, end: to });
    const revenueByDay = new Map<string, number>(days.map((d) => [format(d, "yyyy-MM-dd"), 0]));
    for (const o of consegnati) {
      const key = format(new Date(o.created_at), "yyyy-MM-dd");
      if (revenueByDay.has(key)) revenueByDay.set(key, (revenueByDay.get(key) ?? 0) + Number(o.totale));
    }
    const revenueSeries = days.map((d) => {
      const key = format(d, "yyyy-MM-dd");
      return { label: format(d, "dd/MM"), value: revenueByDay.get(key) ?? 0 };
    });

    const perLido = lidi.map((l) => {
      const ordiniLido = ordini.filter((o) => o.lido_id === l.id);
      const fatturato = ordiniLido
        .filter((o) => o.stato === "consegnati")
        .reduce((s, o) => s + Number(o.totale), 0);
      return { lido: l, ordini: ordiniLido.length, fatturato, ultimoAccesso: ultimoAccesso.get(l.id) ?? null };
    }).sort((a, b) => b.fatturato - a.fatturato);

    return { totalRevenue, totalOrders, lidiAttivi, revenueSeries, perLido };
  }, [lidi, ordini, ultimoAccesso, from, to]);

  return (
    <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-6">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-1">
        <Link to="/ordini" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition">
          <ArrowLeft className="w-4 h-4" /> Torna al gestionale
        </Link>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3 mt-2 mb-1">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-primary">Dashboard admin</h1>
          <p className="text-sm text-muted-foreground mt-1">Panoramica su tutti gli stabilimenti.</p>
        </div>
        <nav className="inline-flex rounded-full border border-border bg-card p-1 text-sm font-medium">
          <span className="px-3.5 py-1.5 rounded-full bg-primary text-primary-foreground inline-flex items-center gap-1.5">
            <LayoutDashboard className="w-3.5 h-3.5" /> Dashboard
          </span>
          <Link to="/admin/nuovo-cliente" className="px-3.5 py-1.5 rounded-full text-muted-foreground hover:text-foreground transition inline-flex items-center gap-1.5">
            <UserPlus className="w-3.5 h-3.5" /> Nuovo cliente
          </Link>
        </nav>
      </div>

      <div className="mt-5 inline-flex rounded-full border border-border bg-card p-1 text-sm font-semibold">
        {([["oggi", "Oggi"], ["settimana", "Settimana"], ["mese", "Mese"]] as const).map(([val, label]) => (
          <button
            key={val}
            onClick={() => setPeriodo(val)}
            className={`px-3.5 py-1.5 rounded-full transition ${periodo === val ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="mt-10 text-center text-muted-foreground text-sm">Caricamento dati…</div>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard icon={<TrendingUp className="w-4 h-4" />} label="Incasso periodo" value={`€ ${metrics.totalRevenue.toFixed(2)}`} />
            <KpiCard icon={<ShoppingBag className="w-4 h-4" />} label="Ordini periodo" value={String(metrics.totalOrders)} />
            <KpiCard icon={<CircleCheck className="w-4 h-4" />} label="Lidi attivi" value={`${metrics.lidiAttivi} / ${lidi.length}`} />
            <KpiCard icon={<Store className="w-4 h-4" />} label="Stabilimenti totali" value={String(lidi.length)} />
          </div>

          <div className="mt-4 card-soft p-4">
            <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary mb-2">
              <TrendingUp className="w-4 h-4" /> Andamento incasso (tutti i lidi)
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metrics.revenueSeries}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={50} />
                  <Tooltip formatter={(v: number) => [`€ ${v.toFixed(2)}`, "Incasso"]} />
                  <Line type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-4 card-soft p-4 overflow-x-auto">
            <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary mb-3">
              <Store className="w-4 h-4" /> Stabilimenti
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="pb-2 font-medium">Nome</th>
                  <th className="pb-2 font-medium">Stato</th>
                  <th className="pb-2 font-medium text-right">Ordini</th>
                  <th className="pb-2 font-medium text-right">Incasso</th>
                  <th className="pb-2 font-medium text-right">Ultimo accesso gestore</th>
                  <th className="pb-2 font-medium text-right">Menu</th>
                </tr>
              </thead>
              <tbody>
                {metrics.perLido.map(({ lido, ordini: ordiniCount, fatturato, ultimoAccesso: lastAccess }) => (
                  <tr key={lido.id} className="border-b border-border last:border-b-0">
                    <td className="py-2.5 font-medium text-foreground">{lido.nome}</td>
                    <td className="py-2.5">
                      {!lido.attivo ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-destructive/10 text-destructive">Disattivo</span>
                      ) : lido.in_pausa ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">In pausa</span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[color:var(--success)]/30 text-[color:var(--success-foreground)]">Attivo</span>
                      )}
                    </td>
                    <td className="py-2.5 text-right">{ordiniCount}</td>
                    <td className="py-2.5 text-right font-semibold text-primary">€ {fatturato.toFixed(2)}</td>
                    <td className="py-2.5 text-right text-muted-foreground" title={lastAccess ? new Date(lastAccess).toLocaleString("it-IT") : undefined}>
                      {lastAccess ? formatDistanceToNow(new Date(lastAccess), { addSuffix: true, locale: it }) : "Mai"}
                    </td>
                    <td className="py-2.5 text-right">
                      <a
                        href={`/lido/${lido.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-teal-600 hover:underline"
                      >
                        Apri <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                  </tr>
                ))}
                {metrics.perLido.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-muted-foreground">Nessuno stabilimento trovato.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="card-soft p-4">
      <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        {icon} {label}
      </div>
      <div className="mt-1.5 text-2xl font-bold text-primary">{value}</div>
    </div>
  );
}
