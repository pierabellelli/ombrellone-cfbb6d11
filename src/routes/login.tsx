import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import beachHero from "@/assets/beach-hero.jpg";
import { ArrowLeft, Loader2 } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Accedi · LidoSmart" },
      { name: "description", content: "Area staff LidoSmart. Accedi per gestire ordini, menu e ombrelloni del tuo lido." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/ordini" });
    });
  }, [navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error("Accesso fallito", { description: error.message });
      return;
    }
    toast.success("Bentornato!");
    navigate({ to: "/ordini" });
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center px-4 py-10">
      {/* Sfondo spiaggia */}
      <div className="absolute inset-0 -z-10">
        <img
          src={beachHero}
          alt=""
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--navy-deep)]/85 via-[color:var(--navy)]/70 to-[color:var(--teal-deep)]/60" />
      </div>

      {/* Home button top-left */}
      <Link
        to="/"
        className="absolute top-5 left-5 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/90 backdrop-blur text-sm font-medium text-primary hover:bg-white transition shadow-[var(--shadow-card)]"
      >
        <ArrowLeft className="w-4 h-4" />
        Home
      </Link>

      {/* Card */}
      <div className="w-full max-w-md card-soft p-8 md:p-10 shadow-[var(--shadow-elevated)] relative">
        <div className="flex justify-center mb-6">
          <Logo size={48} />
        </div>

        <div className="text-center mb-7">
          <div className="text-xs font-bold tracking-[0.18em] text-[color:var(--teal-deep)] uppercase">
            Area staff
          </div>
          <h1 className="mt-2 text-2xl font-bold text-primary">Accedi alla dashboard</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Gestisci ordini, menu e ombrelloni del tuo lido.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1.5">Email</label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="staff@lido.it"
              className="w-full px-4 py-2.5 rounded-lg border border-input bg-card focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-ring transition"
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Password</label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-2.5 rounded-lg border border-input bg-card focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-ring transition"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full brand-gradient rounded-lg py-3 font-semibold shadow-[var(--shadow-card)] hover:opacity-95 transition flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Accedi
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Hai bisogno di un account staff? Contatta il gestore del lido.
        </p>
      </div>
    </div>
  );
}
