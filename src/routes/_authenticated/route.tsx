import { createFileRoute, Outlet, redirect, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { LogOut, ClipboardList, Package, Settings, Map as MapIcon, LayoutPanelTop } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
    return { user: data.user };
  },
  component: AuthLayout,
});

async function loadRoles(userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role, lido_id")
    .eq("user_id", userId);
  return data ?? [];
}

function AuthLayout() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { lang, setLang, t } = useI18n();

  const { data: roles = [] } = useQuery({
    queryKey: ["user_roles", user.id],
    queryFn: () => loadRoles(user.id),
  });

  const isGestore = roles.some((r) => r.role === "gestore");
  const isSuper = roles.some((r) => r.role === "super_admin");
  const isStaff = roles.some((r) => r.role === "staff");
  const canSeeMap = isGestore || isSuper || isStaff;

  const lidoId = roles.find((r) => r.lido_id)?.lido_id ?? null;
  const { data: lidoBranding } = useQuery({
    queryKey: ["lidoBranding", lidoId],
    enabled: !!lidoId,
    queryFn: async () => {
      const { data } = await supabase
        .from("lidi")
        .select("nome, logo_url")
        .eq("id", lidoId!)
        .maybeSingle();
      return data as { nome: string; logo_url: string | null } | null;
    },
  });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  };

  const isAdminArea = pathname.startsWith("/admin");

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/ordini" className="shrink-0 flex items-center gap-2">
              {lidoBranding?.logo_url ? (
                <>
                  <img src={lidoBranding.logo_url} alt={lidoBranding.nome}
                    className="w-9 h-9 rounded-lg object-cover border border-border" />
                  <span className="font-bold text-primary hidden sm:inline">{lidoBranding.nome}</span>
                </>
              ) : (
                <Logo />
              )}
            </Link>
            {!isAdminArea && (
              <nav className="hidden md:flex items-center gap-1">
                <NavLink to="/ordini" icon={<ClipboardList className="w-4 h-4" />} label={t("nav.orders")} />
                {canSeeMap && (
                  <NavLink to="/mappa" icon={<MapIcon className="w-4 h-4" />} label={t("nav.map")} />
                )}
                {(isGestore || isSuper) && (
                  <>
                    <NavLink to="/prodotti" icon={<Package className="w-4 h-4" />} label={t("nav.products")} />
                    <NavLink to="/configurazione-lido" icon={<LayoutPanelTop className="w-4 h-4" />} label={t("nav.beachConfig")} />
                    <NavLink to="/impostazioni" icon={<Settings className="w-4 h-4" />} label={t("nav.settings")} />
                  </>
                )}
              </nav>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="inline-flex rounded-full border border-border bg-card p-0.5 text-xs font-semibold">
              <button
                onClick={() => setLang("it")}
                className={`px-2.5 py-1 rounded-full transition ${lang === "it" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              >IT</button>
              <button
                onClick={() => setLang("en")}
                className={`px-2.5 py-1 rounded-full transition ${lang === "en" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              >EN</button>
            </div>
            <span className="text-sm text-muted-foreground hidden sm:block">{user.email}</span>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border border-border hover:bg-secondary transition"
            >
              <LogOut className="w-4 h-4" /> {t("logout")}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}

function NavLink({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = pathname === to || pathname.startsWith(to + "/");
  return (
    <Link
      to={to}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
        active ? "bg-primary text-primary-foreground" : "hover:bg-secondary text-foreground"
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}
