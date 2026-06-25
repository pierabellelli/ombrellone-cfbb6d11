import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { Umbrella, Save, Plus, Minus } from "lucide-react";

type Numerazione = "auto_lr" | "auto_rl" | "manuale";
type Fila = { index: number; label: string; ombrelloni: { numero: number }[] };

export const Route = createFileRoute("/_authenticated/configurazione-lido")({
  head: () => ({ meta: [{ title: "Configurazione Lido · OmbrellOne" }] }),
  component: BeachConfigPage,
});

async function loadContext() {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { lidoId: null, isManager: false, config: null };
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role, lido_id")
    .eq("user_id", u.user.id);
  const r = roles ?? [];
  const isSuper = r.some((x) => x.role === "super_admin");
  const managerRow = r.find((x) => x.role === "gestore");
  const lidoId = managerRow?.lido_id ?? r.find((x) => x.lido_id)?.lido_id ?? null;
  const isManager = isSuper || !!managerRow;
  if (!lidoId) return { lidoId: null, isManager, config: null };
  const { data: config } = await supabase
    .from("beach_config")
    .select("*")
    .eq("lido_id", lidoId)
    .maybeSingle();
  return { lidoId, isManager, config };
}

function buildAutoFile(count: number, perRow: number, mode: Numerazione, existing: Fila[]): Fila[] {
  const out: Fila[] = [];
  for (let i = 0; i < count; i++) {
    const prev = existing[i];
    const label = prev?.label ?? `Fila ${String.fromCharCode(65 + i)}`;
    const n = prev?.ombrelloni.length || perRow;
    const start = i * n;
    let numeri: number[];
    if (mode === "auto_rl") numeri = Array.from({ length: n }, (_, k) => start + (n - k));
    else if (mode === "auto_lr") numeri = Array.from({ length: n }, (_, k) => start + k + 1);
    else numeri = prev?.ombrelloni.map((o) => o.numero) ?? Array.from({ length: n }, (_, k) => start + k + 1);
    out.push({ index: i, label, ombrelloni: numeri.map((numero) => ({ numero })) });
  }
  return out;
}

function BeachConfigPage() {
  const { t } = useI18n();
  const { data, isLoading, refetch } = useQuery({ queryKey: ["beach-config-ctx"], queryFn: loadContext });

  const [numFile, setNumFile] = useState(3);
  const [perRow, setPerRow] = useState(8);
  const [numerazione, setNumerazione] = useState<Numerazione>("auto_lr");
  const [file, setFile] = useState<Fila[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data?.config) {
      setFile((cur) => buildAutoFile(numFile, perRow, numerazione, cur));
      return;
    }
    const cfg = data.config as unknown as { numero_file: number; numerazione: Numerazione; file: Fila[] };
    setNumFile(cfg.numero_file);
    setNumerazione(cfg.numerazione);
    setFile(cfg.file ?? []);
    setPerRow(cfg.file?.[0]?.ombrelloni.length ?? 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.config]);

  // Rebuild on numFile / perRow / mode changes
  useEffect(() => {
    setFile((cur) => buildAutoFile(numFile, perRow, numerazione, cur));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numFile, numerazione]);

  const updateRowLabel = (i: number, v: string) =>
    setFile((cur) => cur.map((r, idx) => (idx === i ? { ...r, label: v } : r)));

  const updateRowSize = (i: number, n: number) =>
    setFile((cur) =>
      cur.map((r, idx) => {
        if (idx !== i) return r;
        const safeN = Math.max(0, Math.min(60, n));
        const start = idx * (perRow || safeN);
        const base = numerazione === "auto_rl"
          ? Array.from({ length: safeN }, (_, k) => start + (safeN - k))
          : Array.from({ length: safeN }, (_, k) => start + k + 1);
        // Preserve existing numbers where possible (manual)
        const current = r.ombrelloni;
        const next = Array.from({ length: safeN }, (_, k) => current[k] ?? { numero: base[k] });
        return { ...r, ombrelloni: next };
      })
    );

  const updateManualNumber = (i: number, k: number, v: number) =>
    setFile((cur) =>
      cur.map((r, idx) => {
        if (idx !== i) return r;
        const next = r.ombrelloni.map((o, kk) => (kk === k ? { numero: v } : o));
        return { ...r, ombrelloni: next };
      })
    );

  const totale = useMemo(() => file.reduce((s, r) => s + r.ombrelloni.length, 0), [file]);

  const handleSave = async () => {
    if (!data?.lidoId) return;
    setSaving(true);
    const { error } = await supabase
      .from("beach_config")
      .upsert(
        {
          lido_id: data.lidoId,
          numero_file: numFile,
          numerazione,
          file: file as unknown as never,
        },
        { onConflict: "lido_id" }
      );
    setSaving(false);
    if (error) {
      toast.error(t("bc.saveError"), { description: error.message });
      return;
    }
    toast.success(t("bc.saved"));
    refetch();
  };

  if (isLoading) {
    return <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-10 text-muted-foreground">…</div>;
  }
  if (!data?.lidoId) {
    return (
      <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-10">
        <div className="card-soft p-8 text-center text-muted-foreground">{t("bc.noLido")}</div>
      </div>
    );
  }
  if (!data?.isManager) {
    return (
      <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-10">
        <div className="card-soft p-8 text-center text-muted-foreground">{t("bc.onlyManager")}</div>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-primary">{t("bc.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("bc.subtitle")}</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg brand-gradient text-white font-medium disabled:opacity-60"
        >
          <Save className="w-4 h-4" /> {t("bc.save")}
        </button>
      </div>

      <div className="grid lg:grid-cols-[360px_1fr] gap-6 mt-6">
        {/* Form */}
        <div className="card-soft p-5 space-y-5 h-fit">
          <Field label={t("bc.rows")}>
            <NumberStepper value={numFile} min={1} max={30} onChange={setNumFile} />
          </Field>
          <Field label={t("bc.umbrellasInRow") + " (default)"}>
            <NumberStepper value={perRow} min={1} max={60} onChange={(v) => {
              setPerRow(v);
              setFile((cur) => cur.map((r, idx) => {
                const start = idx * v;
                const numeri = numerazione === "auto_rl"
                  ? Array.from({ length: v }, (_, k) => start + (v - k))
                  : Array.from({ length: v }, (_, k) => start + k + 1);
                return { ...r, ombrelloni: numeri.map((numero) => ({ numero })) };
              }));
            }} />
          </Field>
          <div>
            <div className="text-sm font-semibold text-foreground mb-2">{t("bc.numbering")}</div>
            <div className="space-y-1.5">
              {([
                ["auto_lr", t("bc.numAutoLR")],
                ["auto_rl", t("bc.numAutoRL")],
                ["manuale", t("bc.numManual")],
              ] as const).map(([val, lbl]) => (
                <label key={val} className="flex items-center gap-2.5 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="numerazione"
                    checked={numerazione === val}
                    onChange={() => setNumerazione(val)}
                  />
                  {lbl}
                </label>
              ))}
            </div>
          </div>
          <div className="rounded-lg bg-[color:var(--teal)]/10 border border-[color:var(--teal-deep)]/20 px-3 py-2 text-sm">
            {totale} {totale === 1 ? "ombrellone" : "ombrelloni"} totali
          </div>
        </div>

        {/* Row detail + preview */}
        <div className="space-y-6">
          <div className="card-soft p-5">
            <h2 className="font-semibold text-primary mb-3">{t("bc.rowsDetail")}</h2>
            <div className="space-y-3">
              {file.map((r, i) => (
                <div key={i} className="rounded-xl border border-border p-3">
                  <div className="grid sm:grid-cols-[1fr_auto] gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground">{t("bc.rowLabel")}</label>
                      <input
                        value={r.label}
                        onChange={(e) => updateRowLabel(i, e.target.value)}
                        className="mt-1 w-full px-3 py-1.5 rounded-lg border border-input bg-card text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">{t("bc.umbrellasInRow")}</label>
                      <div className="mt-1">
                        <NumberStepper value={r.ombrelloni.length} min={0} max={60} onChange={(v) => updateRowSize(i, v)} />
                      </div>
                    </div>
                  </div>
                  {numerazione === "manuale" && (
                    <div className="mt-3">
                      <label className="text-xs text-muted-foreground">{t("bc.manualNumbers")}</label>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {r.ombrelloni.map((o, k) => (
                          <input
                            key={k}
                            type="number"
                            value={o.numero}
                            onChange={(e) => updateManualNumber(i, k, Number(e.target.value))}
                            className="w-16 px-2 py-1 text-center rounded-md border border-input bg-card text-sm"
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="card-soft p-5">
            <h2 className="font-semibold text-primary mb-3">{t("bc.preview")}</h2>
            <div className="space-y-3">
              {file.map((r, i) => (
                <div key={i}>
                  <div className="text-xs font-semibold text-muted-foreground mb-1.5">{r.label}</div>
                  <div className="flex flex-wrap gap-2">
                    {r.ombrelloni.map((o, k) => (
                      <div
                        key={k}
                        className="w-14 h-14 rounded-xl bg-[color:var(--sky-tint)] border border-[color:var(--teal-deep)]/30 flex flex-col items-center justify-center"
                      >
                        <Umbrella className="w-4 h-4 text-[color:var(--teal-deep)]" />
                        <span className="text-xs font-bold text-primary">{o.numero}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {file.length === 0 && (
                <div className="text-sm text-muted-foreground">—</div>
              )}
            </div>
            <div className="mt-4 text-xs text-muted-foreground">
              <Link to="/mappa" className="underline">→ {t("nav.map")}</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm font-semibold text-foreground">{label}</label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function NumberStepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="inline-flex items-stretch rounded-lg border border-input bg-card overflow-hidden">
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        className="px-2.5 hover:bg-secondary"
        type="button"
      ><Minus className="w-3.5 h-3.5" /></button>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value))))}
        className="w-16 text-center bg-transparent focus:outline-none text-sm font-semibold"
      />
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        className="px-2.5 hover:bg-secondary"
        type="button"
      ><Plus className="w-3.5 h-3.5" /></button>
    </div>
  );
}
