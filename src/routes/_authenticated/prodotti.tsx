import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Plus, Search, Pencil, Trash2, ImagePlus, X, Loader2, Tag, EuroIcon,
  Eye, EyeOff, GripVertical, Upload, Download, FileSpreadsheet,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/prodotti")({
  head: () => ({ meta: [{ title: "Prodotti · LidoSmart" }] }),
  component: ProdottiPage,
});

type Categoria = { id: string; nome: string; ordine: number; lido_id: string };
type Prodotto = {
  id: string;
  lido_id: string;
  categoria_id: string | null;
  nome: string;
  descrizione: string | null;
  prezzo: number;
  foto_url: string | null;
  immagine_url: string | null;
  disponibile: boolean;
};

function normalizeProductName(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

const SIGNED_TTL = 60 * 60 * 24 * 365; // ~1 anno

async function getMyLidoId(): Promise<string | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const { data } = await supabase
    .from("user_roles")
    .select("lido_id, role")
    .eq("user_id", u.user.id)
    .not("lido_id", "is", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.lido_id ?? null;
}

function ProdottiPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoriaSel, setCategoriaSel] = useState<string>("tutte");

  const { data: lidoId, isLoading: lidoLoading } = useQuery({
    queryKey: ["myLidoId"],
    queryFn: getMyLidoId,
  });

  const { data: categorie = [] } = useQuery({
    queryKey: ["categorie", lidoId],
    enabled: !!lidoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categorie_prodotto")
        .select("*")
        .eq("lido_id", lidoId!)
        .order("ordine", { ascending: true })
        .order("nome", { ascending: true });
      if (error) throw error;
      return data as Categoria[];
    },
  });

  const { data: prodotti = [], isLoading: prodLoading } = useQuery({
    queryKey: ["prodotti", lidoId],
    enabled: !!lidoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prodotti")
        .select("*")
        .eq("lido_id", lidoId!)
        .order("nome", { ascending: true });
      if (error) throw error;
      return data as Prodotto[];
    },
  });

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    return prodotti.filter((p) => {
      if (categoriaSel !== "tutte" && p.categoria_id !== categoriaSel) return false;
      if (!t) return true;
      return (
        p.nome.toLowerCase().includes(t) ||
        (p.descrizione ?? "").toLowerCase().includes(t)
      );
    });
  }, [prodotti, search, categoriaSel]);

  const grouped = useMemo(() => {
    const map = new Map<string | null, Prodotto[]>();
    for (const p of filtered) {
      const k = p.categoria_id;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(p);
    }
    return map;
  }, [filtered]);

  // Dialog states
  const [editing, setEditing] = useState<Prodotto | "new" | null>(null);
  const [deleting, setDeleting] = useState<Prodotto | null>(null);
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);

  const toggleDisponibile = async (p: Prodotto) => {
    const { error } = await supabase
      .from("prodotti")
      .update({ disponibile: !p.disponibile })
      .eq("id", p.id);
    if (error) {
      toast.error("Impossibile aggiornare", { description: error.message });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["prodotti"] });
  };

  if (lidoLoading) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-10 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Caricamento…
      </div>
    );
  }

  if (!lidoId) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-10">
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
    <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-primary">Prodotti</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestisci il menu del bar: categorie, prodotti, prezzi e disponibilità.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setBatchOpen(true)}>
            <ImagePlus className="w-4 h-4 mr-1.5" /> Foto in blocco
          </Button>
          <Button variant="outline" onClick={() => setCsvOpen(true)}>
            <Upload className="w-4 h-4 mr-1.5" /> Importa da CSV
          </Button>
          <Button variant="outline" onClick={() => setCatDialogOpen(true)}>
            <Tag className="w-4 h-4 mr-1.5" /> Categorie
          </Button>
          <Button onClick={() => setEditing("new")} className="bg-primary">
            <Plus className="w-4 h-4 mr-1.5" /> Nuovo prodotto
          </Button>
        </div>
      </div>

      <div className="mt-6 card-soft p-4 md:p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setCategoriaSel("tutte")}
              className={`px-3 py-1.5 rounded-full text-sm border transition ${
                categoriaSel === "tutte"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border hover:bg-secondary"
              }`}
            >
              Tutte ({prodotti.length})
            </button>
            {categorie.map((c) => {
              const count = prodotti.filter((p) => p.categoria_id === c.id).length;
              const active = categoriaSel === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setCategoriaSel(c.id)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition ${
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border hover:bg-secondary"
                  }`}
                >
                  {c.nome} ({count})
                </button>
              );
            })}
          </div>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cerca prodotto…"
              className="pl-9 pr-3 py-2 rounded-lg border border-border bg-background text-sm w-64 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>
      </div>

      {prodLoading ? (
        <div className="mt-6 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Caricamento…</div>
      ) : filtered.length === 0 ? (
        <div className="mt-6 card-soft p-10 text-center">
          <p className="text-muted-foreground">Nessun prodotto trovato.</p>
          <Button onClick={() => setEditing("new")} className="mt-4">
            <Plus className="w-4 h-4 mr-1.5" /> Aggiungi prodotto
          </Button>
        </div>
      ) : (
        <div className="mt-6 space-y-8">
          {[...grouped.entries()].map(([catId, items]) => {
            const cat = categorie.find((c) => c.id === catId);
            return (
              <section key={catId ?? "senza"}>
                <h2 className="text-lg font-semibold text-primary mb-3">
                  {cat?.nome ?? "Senza categoria"}{" "}
                  <span className="text-sm font-normal text-muted-foreground">· {items.length}</span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {items.map((p) => (
                    <ProdottoCard
                      key={p.id}
                      prodotto={p}
                      onEdit={() => setEditing(p)}
                      onDelete={() => setDeleting(p)}
                      onToggle={() => toggleDisponibile(p)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {editing !== null && (
        <ProdottoDialog
          open
          onOpenChange={(o) => !o && setEditing(null)}
          prodotto={editing === "new" ? null : editing}
          lidoId={lidoId}
          categorie={categorie}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["prodotti"] });
            setEditing(null);
          }}
        />
      )}

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare "{deleting?.nome}"?</AlertDialogTitle>
            <AlertDialogDescription>
              L'azione non può essere annullata. Gli ordini storici resteranno integri.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!deleting) return;
                const { error } = await supabase.from("prodotti").delete().eq("id", deleting.id);
                if (error) { toast.error("Impossibile eliminare", { description: error.message }); return; }
                toast.success("Prodotto eliminato");
                queryClient.invalidateQueries({ queryKey: ["prodotti"] });
                setDeleting(null);
              }}
            >Elimina</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CategorieDialog
        open={catDialogOpen}
        onOpenChange={setCatDialogOpen}
        lidoId={lidoId}
        categorie={categorie}
        onChange={() => queryClient.invalidateQueries({ queryKey: ["categorie"] })}
      />

      <CsvImportDialog
        open={csvOpen}
        onOpenChange={setCsvOpen}
        lidoId={lidoId}
        categorie={categorie}
        onImported={() => {
          queryClient.invalidateQueries({ queryKey: ["prodotti"] });
          queryClient.invalidateQueries({ queryKey: ["categorie"] });
        }}
      />

      <BatchPhotoDialog
        open={batchOpen}
        onOpenChange={setBatchOpen}
        lidoId={lidoId}
        prodotti={prodotti}
        onDone={() => queryClient.invalidateQueries({ queryKey: ["prodotti"] })}
      />
    </div>
  );
}

function ProdottoCard({
  prodotto, onEdit, onDelete, onToggle,
}: {
  prodotto: Prodotto;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  return (
    <div className={`card-soft overflow-hidden flex flex-col ${!prodotto.disponibile ? "opacity-60" : ""}`}>
      <div className="aspect-[4/3] bg-secondary relative">
        {(prodotto.immagine_url ?? prodotto.foto_url) ? (
          <img src={(prodotto.immagine_url ?? prodotto.foto_url)!} alt={prodotto.nome} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <ImagePlus className="w-8 h-8" />
          </div>
        )}
        {!prodotto.disponibile && (
          <span className="absolute top-2 left-2 bg-foreground/80 text-background text-xs px-2 py-0.5 rounded-full">
            Non disponibile
          </span>
        )}
      </div>
      <div className="p-3 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-foreground leading-snug">{prodotto.nome}</h3>
          <span className="font-bold text-primary whitespace-nowrap">
            € {prodotto.prezzo.toFixed(2)}
          </span>
        </div>
        {prodotto.descrizione && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{prodotto.descrizione}</p>
        )}
        <div className="mt-3 flex items-center justify-between pt-2 border-t border-border">
          <button
            onClick={onToggle}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            title={prodotto.disponibile ? "Rendi non disponibile" : "Rendi disponibile"}
          >
            {prodotto.disponibile ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            {prodotto.disponibile ? "Visibile" : "Nascosto"}
          </button>
          <div className="flex items-center gap-1">
            <button onClick={onEdit} className="p-1.5 rounded hover:bg-secondary" title="Modifica">
              <Pencil className="w-4 h-4 text-muted-foreground" />
            </button>
            <button onClick={onDelete} className="p-1.5 rounded hover:bg-destructive/10" title="Elimina">
              <Trash2 className="w-4 h-4 text-destructive" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProdottoDialog({
  open, onOpenChange, prodotto, lidoId, categorie, onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  prodotto: Prodotto | null;
  lidoId: string;
  categorie: Categoria[];
  onSaved: () => void;
}) {
  const isNew = !prodotto;
  const [nome, setNome] = useState(prodotto?.nome ?? "");
  const [descrizione, setDescrizione] = useState(prodotto?.descrizione ?? "");
  const [prezzo, setPrezzo] = useState<string>(prodotto?.prezzo.toFixed(2) ?? "0.00");
  const [categoriaId, setCategoriaId] = useState<string>(prodotto?.categoria_id ?? "");
  const [disponibile, setDisponibile] = useState(prodotto?.disponibile ?? true);
  const [fotoUrl, setFotoUrl] = useState<string | null>(prodotto?.immagine_url ?? prodotto?.foto_url ?? null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const onPickFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Il file deve essere un'immagine");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("L'immagine supera 5 MB");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${lidoId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("prodotti-immagini")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      const { data: signed, error: sErr } = await supabase.storage
        .from("prodotti-immagini")
        .createSignedUrl(path, SIGNED_TTL);
      if (sErr) throw sErr;
      setFotoUrl(signed.signedUrl);
      toast.success("Foto caricata");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Errore upload";
      toast.error("Impossibile caricare", { description: msg });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    const n = nome.trim();
    if (!n) { toast.error("Nome obbligatorio"); return; }
    const p = Number(prezzo.replace(",", "."));
    if (!Number.isFinite(p) || p < 0) { toast.error("Prezzo non valido"); return; }
    setSaving(true);
    const payload = {
      lido_id: lidoId,
      nome: n,
      descrizione: descrizione.trim() || null,
      prezzo: p,
      categoria_id: categoriaId || null,
      disponibile,
      foto_url: fotoUrl,
      immagine_url: fotoUrl,
    };
    const { error } = isNew
      ? await supabase.from("prodotti").insert(payload)
      : await supabase.from("prodotti").update(payload).eq("id", prodotto!.id);
    setSaving(false);
    if (error) { toast.error("Impossibile salvare", { description: error.message }); return; }
    toast.success(isNew ? "Prodotto creato" : "Prodotto aggiornato");
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isNew ? "Nuovo prodotto" : "Modifica prodotto"}</DialogTitle>
          <DialogDescription>
            {isNew ? "Aggiungi una voce al menu del bar." : "Aggiorna i dettagli del prodotto."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Foto</Label>
            <div className="mt-1.5 flex items-center gap-3">
              <div className="w-24 h-24 rounded-lg overflow-hidden bg-secondary flex items-center justify-center shrink-0">
                {fotoUrl ? (
                  <img src={fotoUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <ImagePlus className="w-6 h-6 text-muted-foreground" />
                )}
              </div>
              <div className="flex flex-col gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onPickFile(f);
                    e.target.value = "";
                  }}
                />
                <Button type="button" variant="outline" size="sm" disabled={uploading}
                  onClick={() => fileRef.current?.click()}>
                  {uploading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <ImagePlus className="w-4 h-4 mr-1.5" />}
                  {fotoUrl ? "Sostituisci" : "Carica foto"}
                </Button>
                {fotoUrl && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setFotoUrl(null)}>
                    <X className="w-4 h-4 mr-1.5" /> Rimuovi
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="nome">Nome *</Label>
            <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={100} className="mt-1.5" />
          </div>

          <div>
            <Label htmlFor="descr">Descrizione</Label>
            <Textarea id="descr" value={descrizione} onChange={(e) => setDescrizione(e.target.value)}
              maxLength={300} rows={2} className="mt-1.5" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="prezzo">Prezzo (€) *</Label>
              <div className="relative mt-1.5">
                <EuroIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input id="prezzo" value={prezzo} onChange={(e) => setPrezzo(e.target.value)}
                  inputMode="decimal" className="pl-9" />
              </div>
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={categoriaId || "_none"} onValueChange={(v) => setCategoriaId(v === "_none" ? "" : v)}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Nessuna" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Nessuna</SelectItem>
                  {categorie.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">Disponibile</p>
              <p className="text-xs text-muted-foreground">Visibile ai clienti nel menu</p>
            </div>
            <Switch checked={disponibile} onCheckedChange={setDisponibile} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={handleSave} disabled={saving || uploading}>
            {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
            {isNew ? "Crea" : "Salva"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CategorieDialog({
  open, onOpenChange, lidoId, categorie, onChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  lidoId: string;
  categorie: Categoria[];
  onChange: () => void;
}) {
  const [nuovo, setNuovo] = useState("");
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState("");

  const handleAdd = async () => {
    const n = nuovo.trim();
    if (!n) return;
    setBusy(true);
    const ord = (categorie[categorie.length - 1]?.ordine ?? 0) + 1;
    const { error } = await supabase
      .from("categorie_prodotto")
      .insert({ lido_id: lidoId, nome: n, ordine: ord });
    setBusy(false);
    if (error) { toast.error("Impossibile creare", { description: error.message }); return; }
    setNuovo("");
    onChange();
  };

  const handleSaveEdit = async (id: string) => {
    const n = editNome.trim();
    if (!n) return;
    const { error } = await supabase
      .from("categorie_prodotto")
      .update({ nome: n })
      .eq("id", id);
    if (error) { toast.error("Impossibile salvare", { description: error.message }); return; }
    setEditId(null);
    onChange();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Eliminare la categoria? I prodotti resteranno senza categoria.")) return;
    const { error } = await supabase.from("categorie_prodotto").delete().eq("id", id);
    if (error) { toast.error("Impossibile eliminare", { description: error.message }); return; }
    onChange();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Categorie</DialogTitle>
          <DialogDescription>
            Organizza il menu in categorie (es. Bevande, Panini, Gelati).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {categorie.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">Nessuna categoria. Aggiungine una qui sotto.</p>
          ) : (
            categorie.map((c) => (
              <div key={c.id} className="flex items-center gap-2 p-2 rounded-lg border border-border">
                <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
                {editId === c.id ? (
                  <>
                    <Input
                      value={editNome}
                      onChange={(e) => setEditNome(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSaveEdit(c.id)}
                      className="h-8"
                      autoFocus
                    />
                    <Button size="sm" onClick={() => handleSaveEdit(c.id)}>Salva</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>Annulla</Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm">{c.nome}</span>
                    <button
                      onClick={() => { setEditId(c.id); setEditNome(c.nome); }}
                      className="p-1.5 rounded hover:bg-secondary"
                    ><Pencil className="w-4 h-4 text-muted-foreground" /></button>
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="p-1.5 rounded hover:bg-destructive/10"
                    ><Trash2 className="w-4 h-4 text-destructive" /></button>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        <div className="flex items-center gap-2 pt-2 border-t border-border">
          <Input
            value={nuovo}
            onChange={(e) => setNuovo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="Nuova categoria…"
          />
          <Button onClick={handleAdd} disabled={busy || !nuovo.trim()}>
            <Plus className="w-4 h-4 mr-1.5" /> Aggiungi
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Chiudi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- CSV IMPORT ----------

type CsvRow = { nome: string; descrizione: string; prezzo: number; categoria: string; disponibile: boolean };

function parseCsv(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return [];
  const split = (line: string): string[] => {
    const out: string[] = [];
    let cur = ""; let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') q = false;
        else cur += ch;
      } else {
        if (ch === '"') q = true;
        else if (ch === ",") { out.push(cur); cur = ""; }
        else cur += ch;
      }
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };
  const header = split(lines[0]).map((h) => h.toLowerCase());
  const idx = (k: string) => header.indexOf(k);
  const iN = idx("nome"), iD = idx("descrizione"), iP = idx("prezzo"),
        iC = idx("categoria"), iA = idx("disponibile");
  if (iN < 0 || iP < 0) throw new Error("CSV: colonne richieste mancanti (nome, prezzo)");
  const rows: CsvRow[] = [];
  for (let r = 1; r < lines.length; r++) {
    const cells = split(lines[r]);
    const nome = (cells[iN] ?? "").trim();
    if (!nome) continue;
    const prezzoRaw = (cells[iP] ?? "0").replace(",", ".").trim();
    const prezzo = Number(prezzoRaw);
    if (!Number.isFinite(prezzo) || prezzo < 0) throw new Error(`Riga ${r + 1}: prezzo non valido`);
    const dispRaw = iA >= 0 ? (cells[iA] ?? "").toLowerCase().trim() : "true";
    const disponibile = dispRaw === "true" || dispRaw === "1" || dispRaw === "si" || dispRaw === "sì" || dispRaw === "yes";
    rows.push({
      nome,
      descrizione: iD >= 0 ? (cells[iD] ?? "").trim() : "",
      prezzo,
      categoria: iC >= 0 ? (cells[iC] ?? "").trim() : "",
      disponibile,
    });
  }
  return rows;
}

function CsvImportDialog({
  open, onOpenChange, lidoId, categorie, onImported,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  lidoId: string;
  categorie: Categoria[];
  onImported: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const downloadTemplate = () => {
    const csv = "nome,descrizione,prezzo,categoria,disponibile\nCoca Cola,Lattina 33cl,3.50,Bibite,true\nSpritz,Aperol Spritz,6.00,Cocktail,true\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "modello-prodotti.csv";
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    if (!file) { toast.error("Seleziona un file CSV"); return; }
    setBusy(true);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length === 0) throw new Error("Il CSV non contiene righe valide");

      // ensure categories exist (create new on the fly)
      const catByName = new Map(categorie.map((c) => [c.nome.toLowerCase(), c.id]));
      const newCatNames = Array.from(new Set(
        rows.map((r) => r.categoria).filter((c) => c && !catByName.has(c.toLowerCase())),
      ));
      for (const cn of newCatNames) {
        const { data, error } = await supabase
          .from("categorie_prodotto")
          .insert({ lido_id: lidoId, nome: cn, ordine: 999 })
          .select("id, nome").single();
        if (error) throw error;
        if (data) catByName.set(data.nome.toLowerCase(), data.id);
      }

      const payload = rows.map((r) => ({
        lido_id: lidoId,
        nome: r.nome.slice(0, 100),
        descrizione: r.descrizione ? r.descrizione.slice(0, 300) : null,
        prezzo: r.prezzo,
        categoria_id: r.categoria ? (catByName.get(r.categoria.toLowerCase()) ?? null) : null,
        disponibile: r.disponibile,
      }));
      const { error } = await supabase.from("prodotti").insert(payload);
      if (error) throw error;
      toast.success(`${payload.length} prodotti importati`);
      onImported();
      onOpenChange(false);
      setFile(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Errore importazione";
      toast.error("Importazione non riuscita", { description: msg });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Importa prodotti da CSV</DialogTitle>
          <DialogDescription>
            Colonne richieste: <code>nome, descrizione, prezzo, categoria, disponibile</code>. I prodotti vengono sempre aggiunti come nuovi.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Button type="button" variant="outline" onClick={downloadTemplate} className="w-full">
            <Download className="w-4 h-4 mr-1.5" /> Scarica modello CSV
          </Button>
          <div>
            <Label htmlFor="csv">File CSV</Label>
            <Input id="csv" type="file" accept=".csv,text/csv" className="mt-1.5"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={handleImport} disabled={busy || !file}>
            {busy && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
            <FileSpreadsheet className="w-4 h-4 mr-1.5" /> Importa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- BATCH PHOTO UPLOAD ----------

function BatchPhotoDialog({
  open, onOpenChange, lidoId, prodotti, onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  lidoId: string;
  prodotti: Prodotto[];
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<{ matched: string[]; unmatched: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const processFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    setBusy(true);
    setResults(null);
    const byNorm = new Map<string, Prodotto>();
    for (const p of prodotti) byNorm.set(normalizeProductName(p.nome), p);

    const matched: string[] = [];
    const unmatched: string[] = [];

    for (const file of list) {
      if (!file.type.startsWith("image/")) { unmatched.push(file.name); continue; }
      const base = file.name.replace(/\.[^.]+$/, "");
      const norm = normalizeProductName(base);
      const target = byNorm.get(norm);
      if (!target) { unmatched.push(file.name); continue; }
      try {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${lidoId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("prodotti-immagini")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) throw upErr;
        const { data: signed, error: sErr } = await supabase.storage
          .from("prodotti-immagini")
          .createSignedUrl(path, SIGNED_TTL);
        if (sErr) throw sErr;
        const { error: updErr } = await supabase.from("prodotti")
          .update({ immagine_url: signed.signedUrl, foto_url: signed.signedUrl })
          .eq("id", target.id);
        if (updErr) throw updErr;
        matched.push(`${file.name} → ${target.nome}`);
      } catch (e: unknown) {
        unmatched.push(file.name);
      }
    }
    setResults({ matched, unmatched });
    setBusy(false);
    if (matched.length > 0) {
      toast.success(`${matched.length} foto associate`);
      onDone();
    }
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files?.length) processFiles(e.dataTransfer.files);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setResults(null); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Carica foto in blocco</DialogTitle>
          <DialogDescription>
            Trascina più immagini: il nome del file (senza estensione) viene abbinato al nome del prodotto, ignorando accenti e simboli.
          </DialogDescription>
        </DialogHeader>
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:bg-secondary/40 transition"
        >
          <ImagePlus className="w-8 h-8 mx-auto text-muted-foreground" />
          <p className="text-sm mt-2 text-muted-foreground">
            Trascina qui le immagini o clicca per selezionarle
          </p>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={(e) => { if (e.target.files) processFiles(e.target.files); e.target.value = ""; }}
          />
        </div>
        {busy && (
          <div className="text-sm text-muted-foreground flex items-center">
            <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Caricamento…
          </div>
        )}
        {results && (
          <div className="space-y-2 text-sm max-h-60 overflow-auto">
            {results.matched.length > 0 && (
              <div>
                <p className="font-medium text-[color:var(--teal-deep)]">Associate ({results.matched.length})</p>
                <ul className="text-xs text-muted-foreground list-disc pl-5">
                  {results.matched.map((m) => <li key={m}>{m}</li>)}
                </ul>
              </div>
            )}
            {results.unmatched.length > 0 && (
              <div>
                <p className="font-medium text-destructive">Senza corrispondenza ({results.unmatched.length})</p>
                <ul className="text-xs text-muted-foreground list-disc pl-5">
                  {results.unmatched.map((m) => <li key={m}>{m}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Chiudi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
