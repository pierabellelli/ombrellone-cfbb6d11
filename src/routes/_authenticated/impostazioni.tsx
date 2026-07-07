import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ImagePlus, ImageOff, Loader2, X, Save, Clock, Coffee, ShieldCheck, Store, CalendarClock, Mail, Copy, Check,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/impostazioni")({
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/login" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
    const allowed = (roles ?? []).some((r) => r.role === "gestore" || r.role === "super_admin");
    if (!allowed) throw redirect({ to: "/ordini" });
  },
  head: () => ({ meta: [{ title: "Impostazioni · OmbrellOne" }] }),
  component: ImpostazioniPage,
});

type Lido = {
  id: string;
  nome: string;
  slug: string;
  logo_url: string | null;
  foto_copertina_url: string | null;
  servizio_bar_attivo: boolean;
  orario_apertura: string | null;
  orario_chiusura: string | null;
  soglia_ordine_libero: number | null;
  max_ordini_ravvicinati: number | null;
  finestra_controllo_minuti: number | null;
  accetta_carta: boolean;
  storico_staff_globale: boolean;
  tempo_attesa_attivo: boolean;
  tempo_attesa_minuti: number | null;
  numero_ordine_partenza: number;
  nascondi_immagini_menu: boolean;
  booking_module_enabled: boolean;
  auto_email_enabled: boolean;
  staff_can_manage_bookings: boolean;
  booking_expiry_time: string;
  max_booking_days_ahead: number;
};

const SIGNED_TTL = 60 * 60 * 24 * 365;
const APP_URL = import.meta.env.VITE_APP_URL ?? "";

async function getMyLido(): Promise<Lido | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const { data: roles } = await supabase
    .from("user_roles")
    .select("lido_id")
    .eq("user_id", u.user.id)
    .not("lido_id", "is", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!roles?.lido_id) return null;
  const { data, error } = await supabase
    .from("lidi")
    .select("*")
    .eq("id", roles.lido_id)
    .maybeSingle();
  if (error) throw error;
  return data as Lido | null;
}

async function getIsGestore(): Promise<boolean> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return false;
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
  return (roles ?? []).some((r) => r.role === "gestore");
}

function ImpostazioniPage() {
  const qc = useQueryClient();
  const { data: lido, isLoading } = useQuery({
    queryKey: ["myLido"],
    queryFn: getMyLido,
  });
  const { data: isGestore = false } = useQuery({
    queryKey: ["myRole-isGestore"],
    queryFn: getIsGestore,
  });

  if (isLoading) {
    return (
      <div className="max-w-[1100px] mx-auto px-4 md:px-6 py-10 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Caricamento…
      </div>
    );
  }

  if (!lido) {
    return (
      <div className="max-w-[1100px] mx-auto px-4 md:px-6 py-10">
        <div className="card-soft p-6 text-center">
          <h2 className="text-lg font-semibold text-primary">Nessun lido associato</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Il tuo account non è ancora associato a uno stabilimento. Contatta l'amministratore.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1100px] mx-auto px-4 md:px-6 py-6 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-primary">Impostazioni</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Branding, orari e regole di servizio per <strong>{lido.nome}</strong>.
        </p>
      </div>

      <DatiGeneraliCard lido={lido} onSaved={() => qc.invalidateQueries({ queryKey: ["myLido"] })} />
      <BrandingCard lido={lido} onSaved={() => qc.invalidateQueries({ queryKey: ["myLido"] })} />
      <RegoleServizioCard lido={lido} onSaved={() => qc.invalidateQueries({ queryKey: ["myLido"] })} />
      <NascondiImmaginiMenuCard lido={lido} onSaved={() => qc.invalidateQueries({ queryKey: ["myLido"] })} />
      <PagamentiCard lido={lido} onSaved={() => qc.invalidateQueries({ queryKey: ["myLido"] })} />
      {isGestore && (
        <StoricoStaffCard lido={lido} onSaved={() => qc.invalidateQueries({ queryKey: ["myLido"] })} />
      )}
      {isGestore && (
        <BookingSettingsCard lido={lido} onSaved={() => qc.invalidateQueries({ queryKey: ["myLido"] })} />
      )}
      {isGestore && lido.booking_module_enabled && (
        <BookingEmailTemplateCard lidoId={lido.id} />
      )}
    </div>
  );
}

function Section({
  icon, title, description, children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card-soft p-5 md:p-6">
      <header className="flex items-start gap-3 pb-4 border-b border-border mb-5">
        <div className="w-10 h-10 rounded-lg bg-[color:var(--teal)]/15 text-[color:var(--teal-deep)] flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div>
          <h2 className="text-lg font-semibold text-primary">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

function DatiGeneraliCard({ lido, onSaved }: { lido: Lido; onSaved: () => void }) {
  const [nome, setNome] = useState(lido.nome);
  const [slug, setSlug] = useState(lido.slug);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setNome(lido.nome); setSlug(lido.slug); }, [lido.id]);

  const dirty = nome.trim() !== lido.nome || slug.trim() !== lido.slug;

  const handleSave = async () => {
    const n = nome.trim();
    const s = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
    if (!n) { toast.error("Nome obbligatorio"); return; }
    if (!s) { toast.error("Slug obbligatorio"); return; }
    setSaving(true);
    const { error } = await supabase.from("lidi").update({ nome: n, slug: s }).eq("id", lido.id);
    setSaving(false);
    if (error) { toast.error("Impossibile salvare", { description: error.message }); return; }
    toast.success("Dati aggiornati");
    onSaved();
  };

  return (
    <Section
      icon={<Store className="w-5 h-5" />}
      title="Dati generali"
      description="Nome dello stabilimento e identificatore usato nel link QR."
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="nome">Nome lido</Label>
          <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={100} className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="slug">Slug (URL)</Label>
          <div className="mt-1.5 flex items-stretch rounded-md border border-input focus-within:ring-2 focus-within:ring-primary/30">
            <span className="px-3 inline-flex items-center bg-secondary text-xs text-muted-foreground rounded-l-md border-r border-input">
              /lido/
            </span>
            <input
              id="slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="flex-1 px-3 py-2 text-sm bg-background rounded-r-md focus:outline-none"
            />
          </div>
        </div>
      </div>
      <div className="flex justify-end mt-5">
        <Button onClick={handleSave} disabled={!dirty || saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
          Salva
        </Button>
      </div>
    </Section>
  );
}

function BrandingCard({ lido, onSaved }: { lido: Lido; onSaved: () => void }) {
  return (
    <Section
      icon={<ImagePlus className="w-5 h-5" />}
      title="Branding"
      description="Logo e foto di copertina mostrati ai clienti dal menu QR."
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ImageUploader
          label="Logo"
          aspect="aspect-square"
          maxClass="w-32 h-32"
          currentUrl={lido.logo_url}
          lidoId={lido.id}
          field="logo_url"
          onSaved={onSaved}
          helpText="Formato consigliato: PNG quadrato con sfondo trasparente, minimo 200×200px. Max 5 MB."
        />
        <ImageUploader
          label="Foto di copertina"
          aspect="aspect-[16/9]"
          maxClass="w-full max-w-md"
          currentUrl={lido.foto_copertina_url}
          lidoId={lido.id}
          field="foto_copertina_url"
          onSaved={onSaved}
          helpText="Formato consigliato: JPG o PNG orizzontale (16:9), minimo 1280×720px. Max 5 MB."
        />
      </div>
    </Section>
  );
}

function ImageUploader({
  label, currentUrl, lidoId, field, onSaved, aspect, maxClass, helpText,
}: {
  label: string;
  currentUrl: string | null;
  lidoId: string;
  field: "logo_url" | "foto_copertina_url";
  onSaved: () => void;
  aspect: string;
  maxClass: string;
  helpText?: string;
}) {
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadAndSave = async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Il file deve essere un'immagine"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("L'immagine supera 5 MB"); return; }
    setBusy(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${lidoId}/${field}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("lidi-branding")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      const { data: signed, error: sErr } = await supabase.storage
        .from("lidi-branding")
        .createSignedUrl(path, SIGNED_TTL);
      if (sErr) throw sErr;
      const patch = { [field]: signed.signedUrl } as Partial<Lido>;
      const { error: updErr } = await (supabase
        .from("lidi") as any)
        .update(patch as any)
        .eq("id", lidoId);
      if (updErr) throw updErr;
      toast.success(`${label} aggiornato`);
      onSaved();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Errore upload";
      toast.error("Impossibile caricare", { description: msg });
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    setBusy(true);
    const patch = { [field]: null } as Partial<Lido>;
    const { error } = await (supabase.from("lidi") as any).update(patch as any).eq("id", lidoId);
    setBusy(false);
    if (error) { toast.error("Impossibile rimuovere", { description: error.message }); return; }
    toast.success(`${label} rimosso`);
    onSaved();
  };

  return (
    <div>
      <Label>{label}</Label>
      <div className={`mt-1.5 ${maxClass}`}>
        <div className={`${aspect} rounded-lg bg-secondary border border-border overflow-hidden flex items-center justify-center`}>
          {currentUrl ? (
            <img src={currentUrl} alt={label} className="w-full h-full object-cover" />
          ) : (
            <ImagePlus className="w-8 h-8 text-muted-foreground" />
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadAndSave(f);
            e.target.value = "";
          }}
        />
        <div className="mt-2 flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={busy}
            onClick={() => fileRef.current?.click()}>
            {busy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <ImagePlus className="w-4 h-4 mr-1.5" />}
            {currentUrl ? "Sostituisci" : "Carica"}
          </Button>
          {currentUrl && (
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={handleRemove}>
              <X className="w-4 h-4 mr-1.5" /> Rimuovi
            </Button>
          )}
        </div>
        {helpText && (
          <p className="text-xs text-muted-foreground mt-1.5">{helpText}</p>
        )}
      </div>
    </div>
  );
}

function RegoleServizioCard({ lido, onSaved }: { lido: Lido; onSaved: () => void }) {
  const [attivo, setAttivo] = useState(lido.servizio_bar_attivo);
  const [apertura, setApertura] = useState((lido.orario_apertura ?? "").slice(0, 5));
  const [chiusura, setChiusura] = useState((lido.orario_chiusura ?? "").slice(0, 5));
  const [soglia, setSoglia] = useState<string>(
    lido.soglia_ordine_libero != null ? String(lido.soglia_ordine_libero) : "",
  );
  const [maxOrd, setMaxOrd] = useState<string>(
    lido.max_ordini_ravvicinati != null ? String(lido.max_ordini_ravvicinati) : "",
  );
  const [finestra, setFinestra] = useState<string>(
    lido.finestra_controllo_minuti != null ? String(lido.finestra_controllo_minuti) : "",
  );
  const [tempoAttesaAttivo, setTempoAttesaAttivo] = useState(lido.tempo_attesa_attivo);
  const [tempoAttesaMinuti, setTempoAttesaMinuti] = useState<string>(
    lido.tempo_attesa_minuti != null ? String(lido.tempo_attesa_minuti) : "",
  );
  const [numeroPartenza, setNumeroPartenza] = useState<string>(String(lido.numero_ordine_partenza));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setAttivo(lido.servizio_bar_attivo);
    setApertura((lido.orario_apertura ?? "").slice(0, 5));
    setChiusura((lido.orario_chiusura ?? "").slice(0, 5));
    setSoglia(lido.soglia_ordine_libero != null ? String(lido.soglia_ordine_libero) : "");
    setMaxOrd(lido.max_ordini_ravvicinati != null ? String(lido.max_ordini_ravvicinati) : "");
    setFinestra(lido.finestra_controllo_minuti != null ? String(lido.finestra_controllo_minuti) : "");
    setTempoAttesaAttivo(lido.tempo_attesa_attivo);
    setTempoAttesaMinuti(lido.tempo_attesa_minuti != null ? String(lido.tempo_attesa_minuti) : "");
    setNumeroPartenza(String(lido.numero_ordine_partenza));
  }, [lido.id]);

  const parseNum = (v: string) => {
    const n = Number(v.replace(",", "."));
    return v === "" ? null : Number.isFinite(n) ? n : NaN;
  };
  const parseInt2 = (v: string) => {
    const n = parseInt(v, 10);
    return v === "" ? null : Number.isFinite(n) ? n : NaN;
  };

  const handleSave = async () => {
    const s = parseNum(soglia);
    const m = parseInt2(maxOrd);
    const f = parseInt2(finestra);
    const tam = parseInt2(tempoAttesaMinuti);
    const np = parseInt2(numeroPartenza);
    if (Number.isNaN(s) || (s !== null && s < 0)) { toast.error("Soglia non valida"); return; }
    if (Number.isNaN(m) || (m !== null && m < 0)) { toast.error("Max ordini non valido"); return; }
    if (Number.isNaN(f) || (f !== null && f < 0)) { toast.error("Finestra controllo non valida"); return; }
    if (tempoAttesaAttivo && (Number.isNaN(tam) || tam === null || tam < 0)) {
      toast.error("Minuti stimati non validi");
      return;
    }
    if (Number.isNaN(np) || np === null || np < 1) { toast.error("Numero ordine di partenza non valido"); return; }

    setSaving(true);
    const { error } = await supabase.from("lidi").update({
      servizio_bar_attivo: attivo,
      orario_apertura: apertura || null,
      orario_chiusura: chiusura || null,
      soglia_ordine_libero: s,
      max_ordini_ravvicinati: m,
      finestra_controllo_minuti: f,
      tempo_attesa_attivo: tempoAttesaAttivo,
      tempo_attesa_minuti: tempoAttesaAttivo ? tam : null,
      numero_ordine_partenza: np,
    }).eq("id", lido.id);
    setSaving(false);
    if (error) { toast.error("Impossibile salvare", { description: error.message }); return; }
    toast.success("Regole aggiornate");
    onSaved();
  };

  return (
    <Section
      icon={<ShieldCheck className="w-5 h-5" />}
      title="Regole di servizio"
      description="Orari del bar, soglia ordine libero e protezioni anti-abuso."
    >
      <div className="space-y-5">
        <div className="flex items-center justify-between rounded-lg border border-border p-4">
          <div className="flex items-center gap-3">
            <Coffee className="w-5 h-5 text-[color:var(--teal-deep)]" />
            <div>
              <p className="text-sm font-medium">Servizio bar attivo</p>
              <p className="text-xs text-muted-foreground">
                Se disattivato, i clienti non possono inviare nuovi ordini.
              </p>
            </div>
          </div>
          <Switch checked={attivo} onCheckedChange={setAttivo} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="ap" className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" /> Orario di apertura
            </Label>
            <Input id="ap" type="time" value={apertura} onChange={(e) => setApertura(e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="ch" className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" /> Orario di chiusura
            </Label>
            <Input id="ch" type="time" value={chiusura} onChange={(e) => setChiusura(e.target.value)} className="mt-1.5" />
          </div>
        </div>

        <div>
          <Label htmlFor="soglia">Soglia ordine libero (€)</Label>
          <Input id="soglia" inputMode="decimal" value={soglia} onChange={(e) => setSoglia(e.target.value)} className="mt-1.5 max-w-xs" />
          <p className="text-xs text-muted-foreground mt-1.5">
            Sotto questa soglia l'ordine è gratuito. Sopra può essere richiesto un pagamento.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="maxord">Max ordini ravvicinati</Label>
            <Input id="maxord" inputMode="numeric" value={maxOrd} onChange={(e) => setMaxOrd(e.target.value)} className="mt-1.5" />
            <p className="text-xs text-muted-foreground mt-1.5">
              Numero massimo di ordini consentiti per ombrellone nella finestra di controllo.
            </p>
          </div>
          <div>
            <Label htmlFor="finestra">Finestra di controllo (minuti)</Label>
            <Input id="finestra" inputMode="numeric" value={finestra} onChange={(e) => setFinestra(e.target.value)} className="mt-1.5" />
            <p className="text-xs text-muted-foreground mt-1.5">
              Intervallo entro il quale si conteggiano gli ordini ravvicinati.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border p-4">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-[color:var(--teal-deep)]" />
            <div>
              <p className="text-sm font-medium">Tempo di attesa stimato</p>
              <p className="text-xs text-muted-foreground">
                Mostra ai clienti una stima del tempo di attesa dopo l'invio dell'ordine.
              </p>
            </div>
          </div>
          <Switch checked={tempoAttesaAttivo} onCheckedChange={setTempoAttesaAttivo} />
        </div>

        {tempoAttesaAttivo && (
          <div>
            <Label htmlFor="tempoattesa">Minuti stimati</Label>
            <Input
              id="tempoattesa"
              inputMode="numeric"
              value={tempoAttesaMinuti}
              onChange={(e) => setTempoAttesaMinuti(e.target.value)}
              className="mt-1.5 max-w-xs"
            />
            <p className="text-xs text-muted-foreground mt-1.5">
              Il gestore può modificarlo in qualsiasi momento, ad esempio nei picchi di lavoro.
            </p>
          </div>
        )}

        <div>
          <Label htmlFor="numeropartenza">Numero ordine di partenza</Label>
          <Input
            id="numeropartenza"
            inputMode="numeric"
            value={numeroPartenza}
            onChange={(e) => setNumeroPartenza(e.target.value)}
            className="mt-1.5 max-w-xs"
          />
          <p className="text-xs text-muted-foreground mt-1.5">
            Imposta da quale numero ripartiranno gli ordini. Cambialo solo prima dell'inizio della stagione o quando non ci sono ancora ordini registrati: modificarlo a stagione iniziata farà saltare la numerazione in avanti o non avrà effetto se il numero scelto è inferiore a quello già raggiunto.
          </p>
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
            Salva regole
          </Button>
        </div>
      </div>
    </Section>
  );
}

function PagamentiCard({ lido, onSaved }: { lido: Lido; onSaved: () => void }) {
  const [accettaCarta, setAccettaCarta] = useState<boolean>(!!lido.accetta_carta);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setAccettaCarta(!!lido.accetta_carta); }, [lido.id, lido.accetta_carta]);

  const dirty = accettaCarta !== !!lido.accetta_carta;

  const onSave = async () => {
    setSaving(true);
    const patch = { accetta_carta: accettaCarta } as Partial<Lido>;
    const { error } = await (supabase.from("lidi") as any).update(patch as any).eq("id", lido.id);
    setSaving(false);
    if (error) { toast.error("Impossibile salvare", { description: error.message }); return; }
    toast.success("Metodi di pagamento aggiornati");
    onSaved();
  };

  return (
    <Section
      icon={<ShieldCheck className="w-5 h-5" />}
      title="Metodi di pagamento"
      description="Scegli come i clienti possono pagare alla consegna."
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-medium text-primary">Accetta pagamento con carta alla consegna</p>
          <p className="text-sm text-muted-foreground">
            Quando attivo, il cliente può scegliere tra contanti e carta in fase d'ordine.
          </p>
        </div>
        <Switch checked={accettaCarta} onCheckedChange={setAccettaCarta} />
      </div>
      <div className="pt-5 flex justify-end">
        <Button onClick={onSave} disabled={!dirty || saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
          Salva
        </Button>
      </div>
    </Section>
  );
}

function NascondiImmaginiMenuCard({ lido, onSaved }: { lido: Lido; onSaved: () => void }) {
  const [nascondi, setNascondi] = useState(lido.nascondi_immagini_menu);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setNascondi(lido.nascondi_immagini_menu); }, [lido.id, lido.nascondi_immagini_menu]);

  const onToggle = async (checked: boolean) => {
    setNascondi(checked);
    setSaving(true);
    const { error } = await (supabase.from("lidi") as any).update({ nascondi_immagini_menu: checked } as any).eq("id", lido.id);
    setSaving(false);
    if (error) {
      setNascondi(lido.nascondi_immagini_menu);
      toast.error("Impossibile salvare", { description: error.message });
      return;
    }
    toast.success("Impostazione aggiornata");
    onSaved();
  };

  return (
    <Section
      icon={<ImageOff className="w-5 h-5" />}
      title="Immagini nel menu"
      description="Se non hai foto per tutti i prodotti, puoi nascondere le immagini nel menu visto dai clienti."
    >
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {nascondi
            ? "Le immagini prodotto sono nascoste nel menu cliente."
            : "Le immagini prodotto sono visibili nel menu cliente (dove presenti)."}
        </p>
        <Switch checked={nascondi} onCheckedChange={onToggle} disabled={saving} />
      </div>
    </Section>
  );
}

function BookingLinkCard({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);
  const link = `${APP_URL}/lido/${slug}/prenota`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Link copiato");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Impossibile copiare il link");
    }
  };

  return (
    <div className="rounded-lg border border-border p-4 bg-secondary/30">
      <p className="text-sm font-medium">Link prenotazioni per i clienti</p>
      <p className="text-xs text-muted-foreground mt-0.5 mb-2">
        Condividi questo link con i clienti (sito, social, WhatsApp) per farli prenotare online.
      </p>
      <div className="flex items-stretch gap-2">
        <input
          readOnly
          value={link}
          onFocus={(e) => e.target.select()}
          className="flex-1 px-3 py-2 rounded-md border border-input bg-background text-sm font-mono truncate"
        />
        <Button type="button" variant="outline" onClick={handleCopy} className="shrink-0">
          {copied ? <Check className="w-4 h-4 mr-1.5" /> : <Copy className="w-4 h-4 mr-1.5" />}
          {copied ? "Copiato" : "Copia"}
        </Button>
      </div>
    </div>
  );
}

function BookingSettingsCard({ lido, onSaved }: { lido: Lido; onSaved: () => void }) {
  const [enabled, setEnabled] = useState(lido.booking_module_enabled);
  const [autoEmail, setAutoEmail] = useState(lido.auto_email_enabled);
  const [staffManage, setStaffManage] = useState(lido.staff_can_manage_bookings);
  const [expiryTime, setExpiryTime] = useState(lido.booking_expiry_time.slice(0, 5));
  const [maxDays, setMaxDays] = useState(String(lido.max_booking_days_ahead));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEnabled(lido.booking_module_enabled);
    setAutoEmail(lido.auto_email_enabled);
    setStaffManage(lido.staff_can_manage_bookings);
    setExpiryTime(lido.booking_expiry_time.slice(0, 5));
    setMaxDays(String(lido.max_booking_days_ahead));
  }, [lido.id]);

  const dirty =
    enabled !== lido.booking_module_enabled ||
    autoEmail !== lido.auto_email_enabled ||
    staffManage !== lido.staff_can_manage_bookings ||
    expiryTime !== lido.booking_expiry_time.slice(0, 5) ||
    maxDays !== String(lido.max_booking_days_ahead);

  const handleSave = async () => {
    const days = parseInt(maxDays, 10);
    if (!expiryTime) { toast.error("Orario di scadenza non valido"); return; }
    if (!Number.isFinite(days) || days < 0) { toast.error("Giorni massimi non validi"); return; }

    setSaving(true);
    const { error } = await supabase.from("lidi").update({
      booking_module_enabled: enabled,
      auto_email_enabled: autoEmail,
      staff_can_manage_bookings: staffManage,
      booking_expiry_time: `${expiryTime}:00`,
      max_booking_days_ahead: days,
    }).eq("id", lido.id);
    setSaving(false);
    if (error) { toast.error("Impossibile salvare", { description: error.message }); return; }
    toast.success("Impostazioni prenotazioni aggiornate");
    onSaved();
  };

  return (
    <Section
      icon={<CalendarClock className="w-5 h-5" />}
      title="Prenotazioni"
      description="Modulo prenotazioni ombrelloni: attivazione, regole di scadenza e permessi."
    >
      <div className="space-y-5">
        <div className="flex items-center justify-between rounded-lg border border-border p-4">
          <div>
            <p className="text-sm font-medium">Modulo prenotazioni attivo</p>
            <p className="text-xs text-muted-foreground">
              Se disattivato, il tab Prenotazioni e il form pubblico sono nascosti.
            </p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>

        {enabled && <BookingLinkCard slug={lido.slug} />}

        <div className="flex items-center justify-between rounded-lg border border-border p-4">
          <div>
            <p className="text-sm font-medium">Email automatiche</p>
            <p className="text-xs text-muted-foreground">
              Invia una email di conferma al cliente e una notifica al gestore per ogni nuova prenotazione.
            </p>
          </div>
          <Switch checked={autoEmail} onCheckedChange={setAutoEmail} />
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border p-4">
          <div>
            <p className="text-sm font-medium">Staff può gestire le prenotazioni</p>
            <p className="text-xs text-muted-foreground">
              Se disattivato, lo staff vede le prenotazioni in sola lettura: solo il gestore può fare check-in, riservare o cancellare.
            </p>
          </div>
          <Switch checked={staffManage} onCheckedChange={setStaffManage} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="scadenza" className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" /> Orario di scadenza check-in
            </Label>
            <Input id="scadenza" type="time" value={expiryTime} onChange={(e) => setExpiryTime(e.target.value)} className="mt-1.5 max-w-xs" />
            <p className="text-xs text-muted-foreground mt-1.5">
              Ora entro cui il cliente deve presentarsi, altrimenti la prenotazione risulta scaduta.
            </p>
          </div>
          <div>
            <Label htmlFor="maxgiorni">Giorni massimi di anticipo</Label>
            <Input id="maxgiorni" inputMode="numeric" value={maxDays} onChange={(e) => setMaxDays(e.target.value)} className="mt-1.5 max-w-xs" />
            <p className="text-xs text-muted-foreground mt-1.5">
              Quanti giorni nel futuro un cliente può prenotare rispetto a oggi.
            </p>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} disabled={!dirty || saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
            Salva
          </Button>
        </div>
      </div>
    </Section>
  );
}

type BookingEmailTemplate = {
  subject_cliente: string;
  body_cliente: string;
  subject_gestore: string;
  body_gestore: string;
};

const TEMPLATE_VARS = ["nome", "cognome", "data", "fila", "numero_ombrellone", "ora_scadenza", "lido_nome"];

const DEFAULT_TEMPLATE: BookingEmailTemplate = {
  subject_cliente: "Prenotazione confermata - {{lido_nome}}",
  body_cliente:
    "Ciao {{nome}},\n\nla tua prenotazione per il {{data}} è confermata: {{fila}}, ombrellone {{numero_ombrellone}}.\nTi aspettiamo entro le {{ora_scadenza}}, altrimenti il posto potrebbe essere riassegnato.\n\nA presto,\n{{lido_nome}}",
  subject_gestore: "Nuova prenotazione - {{fila}} {{numero_ombrellone}} il {{data}}",
  body_gestore:
    "Nuova prenotazione da {{nome}} {{cognome}} per il {{data}}.\n{{fila}}, ombrellone {{numero_ombrellone}}.\nScadenza check-in: {{ora_scadenza}}.",
};

async function loadBookingEmailTemplate(lidoId: string): Promise<BookingEmailTemplate> {
  const { data, error } = await supabase
    .from("booking_email_templates")
    .select("subject_cliente, body_cliente, subject_gestore, body_gestore")
    .eq("lido_id", lidoId)
    .maybeSingle();
  if (error) throw error;
  return data ?? DEFAULT_TEMPLATE;
}

function BookingEmailTemplateCard({ lidoId }: { lidoId: string }) {
  const qc = useQueryClient();
  const { data: tpl, isLoading } = useQuery({
    queryKey: ["bookingEmailTemplate", lidoId],
    queryFn: () => loadBookingEmailTemplate(lidoId),
  });

  const [subjectCliente, setSubjectCliente] = useState("");
  const [bodyCliente, setBodyCliente] = useState("");
  const [subjectGestore, setSubjectGestore] = useState("");
  const [bodyGestore, setBodyGestore] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  if (tpl && loadedFor !== lidoId) {
    setSubjectCliente(tpl.subject_cliente);
    setBodyCliente(tpl.body_cliente);
    setSubjectGestore(tpl.subject_gestore);
    setBodyGestore(tpl.body_gestore);
    setLoadedFor(lidoId);
  }

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from("booking_email_templates").upsert(
      {
        lido_id: lidoId,
        subject_cliente: subjectCliente,
        body_cliente: bodyCliente,
        subject_gestore: subjectGestore,
        body_gestore: bodyGestore,
      },
      { onConflict: "lido_id" },
    );
    setSaving(false);
    if (error) { toast.error("Impossibile salvare", { description: error.message }); return; }
    toast.success("Template email aggiornato");
    qc.invalidateQueries({ queryKey: ["bookingEmailTemplate", lidoId] });
  };

  return (
    <Section
      icon={<Mail className="w-5 h-5" />}
      title="Template email prenotazioni"
      description="Personalizza i testi delle email inviate a cliente e gestore. Variabili disponibili: {{nome}}, {{cognome}}, {{data}}, {{fila}}, {{numero_ombrellone}}, {{ora_scadenza}}, {{lido_nome}}."
    >
      {isLoading ? (
        <div className="text-sm text-muted-foreground inline-flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Caricamento…
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-primary mb-3">Email al cliente</h3>
            <div className="space-y-3">
              <div>
                <Label htmlFor="subj-cliente">Oggetto</Label>
                <Input id="subj-cliente" value={subjectCliente} onChange={(e) => setSubjectCliente(e.target.value)} className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="body-cliente">Corpo</Label>
                <textarea
                  id="body-cliente"
                  value={bodyCliente}
                  onChange={(e) => setBodyCliente(e.target.value)}
                  rows={5}
                  className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-primary mb-3">Notifica al gestore</h3>
            <div className="space-y-3">
              <div>
                <Label htmlFor="subj-gestore">Oggetto</Label>
                <Input id="subj-gestore" value={subjectGestore} onChange={(e) => setSubjectGestore(e.target.value)} className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="body-gestore">Corpo</Label>
                <textarea
                  id="body-gestore"
                  value={bodyGestore}
                  onChange={(e) => setBodyGestore(e.target.value)}
                  rows={5}
                  className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {TEMPLATE_VARS.map((v) => (
              <span key={v} className="text-xs font-mono px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                {`{{${v}}}`}
              </span>
            ))}
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
              Salva template
            </Button>
          </div>
        </div>
      )}
    </Section>
  );
}

function StoricoStaffCard({ lido, onSaved }: { lido: Lido; onSaved: () => void }) {
  const [globale, setGlobale] = useState(lido.storico_staff_globale);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setGlobale(lido.storico_staff_globale); }, [lido.id, lido.storico_staff_globale]);

  const onToggle = async (checked: boolean) => {
    setGlobale(checked);
    setSaving(true);
    const { error } = await (supabase.from("lidi") as any).update({ storico_staff_globale: checked } as any).eq("id", lido.id);
    setSaving(false);
    if (error) {
      setGlobale(lido.storico_staff_globale);
      toast.error("Impossibile salvare", { description: error.message });
      return;
    }
    toast.success("Impostazione aggiornata");
    onSaved();
  };

  return (
    <Section
      icon={<ShieldCheck className="w-5 h-5" />}
      title="Storico ordini staff"
      description="Se attivo, ogni membro dello staff può vedere tutti gli ordini del lido. Se disattivo, ogni staff vede solo gli ordini che ha preso in carico."
    >
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {globale
            ? "Lo staff vede tutti gli ordini del lido nella sezione Storico."
            : "Ogni membro dello staff vede solo gli ordini che ha preso in carico."}
        </p>
        <Switch checked={globale} onCheckedChange={onToggle} disabled={saving} />
      </div>
    </Section>
  );
}
