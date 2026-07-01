import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";

export const Route = createFileRoute("/accetta-invito")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Accetta invito · OmbrellOne" },
      { name: "description", content: "Imposta la password per accedere al tuo account OmbrellOne." },
    ],
  }),
  component: AccettaInvitoPage,
});

type SessionState = "verifying" | "ready" | "invalid";

function AccettaInvitoPage() {
  const navigate = useNavigate();
  const [sessionState, setSessionState] = useState<SessionState>("verifying");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const setupSession = async () => {
      const hash = window.location.hash.startsWith("#")
        ? window.location.hash.slice(1)
        : window.location.hash;
      const params = new URLSearchParams(hash);
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");
      const type = params.get("type");

      if (!accessToken || !refreshToken || type !== "invite") {
        setSessionState("invalid");
        return;
      }

      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (error) {
        setSessionState("invalid");
        return;
      }

      setSessionState("ready");
    };

    setupSession();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (password.length < 8) {
      setFormError("La password deve contenere almeno 8 caratteri.");
      return;
    }
    if (password !== confirmPassword) {
      setFormError("Le password non coincidono.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      toast.error("Impossibile impostare la password", { description: error.message });
      return;
    }

    toast.success("Password impostata con successo");
    navigate({ to: "/mappa" });
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center px-4 py-10">
      {/* Sfondo spiaggia */}
      <div className="absolute inset-0 -z-10">
        <img
          src="/umbrella-sea.jpg"
          alt=""
          className="w-full h-full object-cover"
          style={{ objectPosition: "50% 65%" }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--navy-deep)]/80 to-[color:var(--navy)]/75 z-0" />
      </div>

      {/* Home button top-left */}
      <Link
        to="/"
        className="absolute top-5 left-5 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/90 backdrop-blur text-sm font-medium text-primary hover:bg-white transition shadow-[var(--shadow-card)]"
      >
        <ArrowLeft className="w-4 h-4" />
        Home
      </Link>

      {/* Headline + card */}
      <div className="w-full max-w-md relative z-10">
        <p
          className="text-white text-2xl font-bold mb-6 text-center drop-shadow-lg"
          style={{ textShadow: "0 2px 8px rgba(0,0,0,0.5)" }}
        >
          Benvenuto in OmbrellOne
        </p>

        <div className="bg-white rounded-2xl p-8 md:p-10 shadow-2xl">
          <img src="/logo_ombrellOne.png" alt="OmbrellOne" className="h-24 w-auto mx-auto mb-8" />

          {sessionState === "verifying" && (
            <div className="flex flex-col items-center gap-3 py-6 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin" />
              <p className="text-sm">Verifica dell'invito in corso…</p>
            </div>
          )}

          {sessionState === "invalid" && (
            <div className="text-center space-y-4">
              <p className="text-sm font-medium text-destructive bg-destructive/10 rounded-lg py-3 px-4">
                Il link di invito non è valido o è scaduto.
              </p>
              <p className="text-sm text-muted-foreground">
                Richiedi al tuo gestore un nuovo invito, oppure contattaci a{" "}
                <a href="mailto:ciao@ombrellone.app" className="text-teal-600 hover:underline font-medium">
                  ciao@ombrellone.app
                </a>
                .
              </p>
              <a href="/#contatto" className="mt-2 block text-center text-sm text-teal-600 hover:underline">
                Vuoi provare OmbrellOne? Richiedi una demo gratuita
              </a>
            </div>
          )}

          {sessionState === "ready" && (
            <form onSubmit={onSubmit} className="space-y-4">
              <p className="text-sm text-muted-foreground -mt-2 mb-2">
                Imposta la password per accedere al tuo account.
              </p>
              <div>
                <label className="text-sm font-medium block mb-1.5">Nuova password</label>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 rounded-lg border border-input bg-card focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-ring transition"
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">Conferma password</label>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 rounded-lg border border-input bg-card focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-ring transition"
                />
              </div>

              {formError && (
                <p className="text-sm font-medium text-destructive bg-destructive/10 rounded-lg py-2.5 px-3">
                  {formError}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full brand-gradient rounded-lg py-3 font-semibold shadow-[var(--shadow-card)] hover:opacity-95 transition flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Imposta password
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
