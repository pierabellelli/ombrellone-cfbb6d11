import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { QRCodeCanvas } from "qrcode.react";
import { Printer, Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/qrcode")({
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/login" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
    const isGestore = (roles ?? []).some((r) => r.role === "gestore");
    if (!isGestore) throw redirect({ to: "/ordini" });
  },
  head: () => ({ meta: [{ title: "QR Code · OmbrellOne" }] }),
  component: QrCodePage,
});

type Fila = { index: number; label: string; ombrelloni: { numero: number }[] };
type Lido = { id: string; nome: string; slug: string };
type Ombrellone = { numero: number; fila: string };

const APP_URL = import.meta.env.VITE_APP_URL ?? "";

async function loadQrData(): Promise<{ lido: Lido; ombrelloni: Ombrellone[]; filaLabels: string[] } | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("lido_id")
    .eq("user_id", u.user.id)
    .not("lido_id", "is", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!roleRow?.lido_id) return null;

  const { data: lido, error: lidoErr } = await supabase
    .from("lidi")
    .select("id, nome, slug")
    .eq("id", roleRow.lido_id)
    .maybeSingle();
  if (lidoErr) throw lidoErr;
  if (!lido) return null;

  const { data: config, error: cfgErr } = await supabase
    .from("beach_config")
    .select("file")
    .eq("lido_id", roleRow.lido_id)
    .maybeSingle();
  if (cfgErr) throw cfgErr;

  const file = ((config?.file as unknown) as Fila[] | null) ?? [];
  const ombrelloni: Ombrellone[] = [];
  for (const fila of file) {
    for (const u2 of fila.ombrelloni ?? []) {
      ombrelloni.push({ numero: u2.numero, fila: fila.label });
    }
  }
  ombrelloni.sort((a, b) => a.numero - b.numero);
  const filaLabels = file.map((f) => f.label);

  return { lido: lido as Lido, ombrelloni, filaLabels };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function QrCodePage() {
  const { data, isLoading } = useQuery({ queryKey: ["qrcode-data"], queryFn: loadQrData });
  const [filaFilter, setFilaFilter] = useState("");

  const filtered = useMemo(() => {
    const list = data?.ombrelloni ?? [];
    return filaFilter ? list.filter((o) => o.fila === filaFilter) : list;
  }, [data, filaFilter]);

  const pages = useMemo(() => chunk(filtered, 9), [filtered]);

  if (isLoading) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-10 text-center text-muted-foreground">
        Caricamento…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-10">
        <div className="card-soft p-6 text-center">
          <h2 className="text-lg font-semibold text-primary">Nessun lido associato</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Il tuo account non è ancora associato a uno stabilimento.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-6">
      <div className="print:hidden flex items-start justify-between flex-wrap gap-4 mb-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-primary">QR Code Ombrelloni</h1>
          <p className="text-sm text-muted-foreground mt-1">Stampa i QR code da posizionare su ogni ombrellone.</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filaFilter}
            onChange={(e) => setFilaFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-border bg-card text-sm"
          >
            <option value="">Tutte le file</option>
            {data.filaLabels.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:opacity-95 transition"
          >
            <Printer className="w-4 h-4" /> Stampa tutti
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="print:hidden card-soft p-8 text-center text-muted-foreground">
          Nessun ombrellone configurato.
        </div>
      ) : (
        pages.map((page, i) => (
          <div
            key={i}
            className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-3 gap-4 mb-4 ${
              i < pages.length - 1 ? "print:break-after-page" : ""
            }`}
          >
            {page.map((o) => (
              <QrCard key={o.numero} lidoNome={data.lido.nome} slug={data.lido.slug} numero={o.numero} fila={o.fila} />
            ))}
          </div>
        ))
      )}
    </div>
  );
}

function QrCard({ lidoNome, slug, numero, fila }: { lidoNome: string; slug: string; numero: number; fila: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const value = `${APP_URL}/lido/${slug}?o=${numero}`;

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `qr-ombrellone-${numero}.png`;
    a.click();
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 flex flex-col items-center text-center print:shadow-none print:border print:border-dashed print:border-gray-400 print:rounded-none">
      <QRCodeCanvas ref={canvasRef} value={value} size={180} includeMargin />

      <div className="mt-3 text-xs text-muted-foreground">{lidoNome}</div>

      <div className="print:hidden mt-1">
        <div className="text-2xl font-bold text-primary">{numero}</div>
        <div className="text-xs text-muted-foreground">{fila}</div>
      </div>

      <div className="hidden print:block mt-1">
        <div className="text-sm font-semibold">Ombrellone {numero} · {fila}</div>
        <div className="text-[9px] text-gray-500 mt-0.5 break-all">{value}</div>
      </div>

      <button
        onClick={handleDownload}
        className="print:hidden mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-border hover:bg-secondary transition"
      >
        <Download className="w-3.5 h-3.5" /> Scarica PNG
      </button>
    </div>
  );
}
