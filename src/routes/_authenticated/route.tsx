import { createFileRoute, Outlet, redirect, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { LogOut, ClipboardList, UtensilsCrossed, Settings, Map as MapIcon, LayoutPanelTop, BarChart3, QrCode, MoreHorizontal, X, LayoutDashboard, CalendarClock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";

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
  const { setLang, t } = useI18n();

  useEffect(() => {
    setLang("it");
  }, [setLang]);

  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [installDismissed, setInstallDismissed] = useState(
    () => localStorage.getItem("pwa-install-dismissed") === "true",
  );

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const showInstallBanner =
    !!installPrompt &&
    !installDismissed &&
    window.matchMedia("(display-mode: browser)").matches;

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  const handleDismissInstall = () => {
    localStorage.setItem("pwa-install-dismissed", "true");
    setInstallDismissed(true);
  };

  const { data: roles = [] } = useQuery({
    queryKey: ["user_roles", user.id],
    queryFn: () => loadRoles(user.id),
  });

  const isGestore = roles.some((r) => r.role === "gestore");
  const isSuper = roles.some((r) => r.role === "super_admin");
  const isStaff = roles.some((r) => r.role === "staff");
  const canSeeMap = isGestore || isSuper || isStaff;
  const isStaffOnly = isStaff && !isGestore && !isSuper;

  const lidoId = roles.find((r) => r.lido_id)?.lido_id ?? null;
  const { data: lidoBranding } = useQuery({
    queryKey: ["lidoBranding", lidoId],
    enabled: !!lidoId,
    queryFn: async () => {
      const { data } = await supabase
        .from("lidi")
        .select("nome, logo_url, booking_module_enabled")
        .eq("id", lidoId!)
        .maybeSingle();
      return data as { nome: string; logo_url: string | null; booking_module_enabled: boolean } | null;
    },
  });
  const canSeeBookings = (isGestore || isSuper || isStaff) && !!lidoBranding?.booking_module_enabled;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  };

  const isAdminArea = pathname.startsWith("/admin");

  const navItems: { to: string; icon: ReactNode; label: string; visible: boolean }[] = [
    { to: "/mappa", icon: <MapIcon className="w-4 h-4" />, label: t("nav.map"), visible: canSeeMap },
    { to: "/prenotazioni", icon: <CalendarClock className="w-4 h-4" />, label: t("nav.bookings"), visible: canSeeBookings },
    { to: "/ordini", icon: <ClipboardList className="w-4 h-4" />, label: t("nav.orders"), visible: true },
    { to: "/prodotti", icon: <UtensilsCrossed className="w-4 h-4" />, label: t("nav.products"), visible: isGestore || isSuper },
    { to: "/configurazione-lido", icon: <LayoutPanelTop className="w-4 h-4" />, label: t("nav.beachConfig"), visible: isGestore || isSuper },
    { to: "/qrcode", icon: <QrCode className="w-4 h-4" />, label: t("nav.qrcode"), visible: isGestore },
    { to: "/report", icon: <BarChart3 className="w-4 h-4" />, label: isStaffOnly ? t("nav.storico") : t("nav.report"), visible: isGestore || isStaffOnly },
    { to: "/admin/dashboard", icon: <LayoutDashboard className="w-4 h-4" />, label: "Admin", visible: isSuper },
    { to: "/impostazioni", icon: <Settings className="w-4 h-4" />, label: t("nav.settings"), visible: isGestore || isSuper },
  ];
  const visibleNavItems = navItems.filter((item) => item.visible);
  const mobileTabs = visibleNavItems.length > 5 ? visibleNavItems.slice(0, 4) : visibleNavItems;
  const mobileMoreItems = visibleNavItems.length > 5 ? visibleNavItems.slice(4) : [];

  return (
    <div className="min-h-screen flex flex-col">
      {showInstallBanner && (
        <div className="md:hidden flex items-center justify-between gap-3 px-4 py-2 bg-[#1D9E75] text-white text-sm">
          <span className="flex-1">
            📱 Installa OmbrellOne sul tuo telefono per un'esperienza migliore
          </span>
          <button
            onClick={handleInstall}
            className="shrink-0 px-3 py-1 rounded-md bg-white/20 hover:bg-white/30 font-medium transition"
          >
            Installa
          </button>
          <button onClick={handleDismissInstall} className="shrink-0" aria-label="Chiudi">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/mappa" className="shrink-0 flex items-center gap-2">
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
                {visibleNavItems.map((item) => (
                  <NavLink key={item.to} to={item.to} icon={item.icon} label={item.label} />
                ))}
              </nav>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border border-border hover:bg-secondary transition"
            >
              <LogOut className="w-4 h-4" /> {t("logout")}
            </button>
          </div>
        </div>
      </header>

      <main className={`flex-1 ${!isAdminArea ? "pb-16 md:pb-0" : ""}`}>
        <Outlet />
      </main>

      {!isAdminArea && (
        <MobileBottomNav tabs={mobileTabs} moreItems={mobileMoreItems} moreLabel={t("nav.more")} />
      )}
    </div>
  );
}

function MobileBottomNav({
  tabs, moreItems, moreLabel,
}: {
  tabs: { to: string; icon: ReactNode; label: string }[];
  moreItems: { to: string; icon: ReactNode; label: string }[];
  moreLabel: string;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = moreItems.some((item) => pathname === item.to || pathname.startsWith(item.to + "/"));

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-card border-t border-border flex items-stretch">
      {tabs.map((item) => (
        <MobileNavLink key={item.to} to={item.to} icon={item.icon} label={item.label} />
      ))}
      {moreItems.length > 0 && (
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition ${
              moreActive ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <MoreHorizontal className="w-5 h-5" />
            {moreLabel}
          </button>
          <SheetContent side="bottom" className="rounded-t-2xl">
            <SheetHeader><SheetTitle>{moreLabel}</SheetTitle></SheetHeader>
            <div className="mt-2 flex flex-col">
              {moreItems.map((item) => (
                <SheetClose asChild key={item.to}>
                  <Link
                    to={item.to}
                    className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition ${
                      pathname === item.to || pathname.startsWith(item.to + "/")
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-secondary text-foreground"
                    }`}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                </SheetClose>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </nav>
  );
}

function MobileNavLink({ to, icon, label }: { to: string; icon: ReactNode; label: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = pathname === to || pathname.startsWith(to + "/");
  return (
    <Link
      to={to}
      className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition ${
        active ? "text-primary" : "text-muted-foreground"
      }`}
    >
      {icon}
      {label}
    </Link>
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
