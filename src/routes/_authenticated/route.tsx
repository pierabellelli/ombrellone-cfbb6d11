import { createFileRoute, Outlet, redirect, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { LogOut, ClipboardList, Package, Settings } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

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

  const { data: roles = [] } = useQuery({
    queryKey: ["user_roles", user.id],
    queryFn: () => loadRoles(user.id),
  });

  const isGestore = roles.some((r) => r.role === "gestore");
  const isSuper = roles.some((r) => r.role === "super_admin");

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  };

  const isAdminArea = pathname.startsWith("/admin");

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link to="/ordini" className="shrink-0"><Logo /></Link>
            {!isAdminArea && (
              <nav className="hidden md:flex items-center gap-1">
                <NavLink to="/ordini" icon={<ClipboardList className="w-4 h-4" />} label="Ordini" />
                {(isGestore || isSuper) && (
                  <>
                    <NavLink to="/prodotti" icon={<Package className="w-4 h-4" />} label="Prodotti" />
                    <NavLink to="/impostazioni" icon={<Settings className="w-4 h-4" />} label="Impostazioni" />
                  </>
                )}
              </nav>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:block">{user.email}</span>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border border-border hover:bg-secondary transition"
            >
              <LogOut className="w-4 h-4" /> Esci
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
