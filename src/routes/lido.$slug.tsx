import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ShoppingCart, Plus, Minus, X, Search, Loader2, CheckCircle2, Clock,
  AlertTriangle, MapPin, ArrowLeft, ChevronDown, ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { useI18n } from "@/lib/i18n";

const LS_KEY = "ombrellone_cliente";
type StoredCustomer = { telefono: string; cognome: string };

function readStoredCustomer(): StoredCustomer | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (p && typeof p.telefono === "string" && typeof p.cognome === "string") return p;
  } catch { /* ignore */ }
  return null;
}
function writeStoredCustomer(telefono: string, cognome: string) {
  if (typeof window === "undefined") return;
  const existing = readStoredCustomer();
  // keep first saved name; only update phone
  const next: StoredCustomer = {
    telefono,
    cognome: existing?.cognome?.trim() ? existing.cognome : cognome,
  };
  try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
}

const searchSchema = z.object({
  o: z.string().optional(),
});

export const Route = createFileRoute("/lido/$slug")({
  validateSearch: searchSchema,
  head: ({ params }) => ({
    meta: [
      { title: `Menu · ${params.slug} · LidoSmart` },
      { name: "description", content: "Ordina dal tuo ombrellone tramite il QR del lido." },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1" },
    ],
  }),
  component: LidoClientPage,
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
  accetta_carta: boolean;
};

type Categoria = { id: string; nome: string; ordine: number };
type Prodotto = {
  id: string;
  nome: string;
  descrizione: string | null;
  prezzo: number;
  foto_url: string | null;
  immagine_url: string | null;
  categoria_id: string | null;
  disponibile: boolean;
};

type CartItem = { prodotto: Prodotto; quantita: number };

function LidoClientPage() {
  const { slug } = Route.useParams();
  const { o: ombrelloneParam } = Route.useSearch();

  const { data: lido, isLoading: lidoLoading, error: lidoErr } = useQuery({
    queryKey: ["pub-lido", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lidi")
        .select("id, nome, slug, logo_url, foto_copertina_url, servizio_bar_attivo, orario_apertura, orario_chiusura, soglia_ordine_libero, accetta_carta")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data as Lido | null;
    },
  });

  const { data: categorie = [] } = useQuery({
    queryKey: ["pub-cat", lido?.id],
    enabled: !!lido?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categorie_prodotto")
        .select("id, nome, ordine")
        .eq("lido_id", lido!.id)
        .order("ordine").order("nome");
      if (error) throw error;
      return data as Categoria[];
    },
  });

  const { data: prodotti = [], isLoading: prodLoading } = useQuery({
    queryKey: ["pub-prod", lido?.id],
    enabled: !!lido?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prodotti")
        .select("id, nome, descrizione, prezzo, foto_url, immagine_url, categoria_id, disponibile")
        .eq("lido_id", lido!.id)
        .eq("disponibile", true)
        .order("nome");
      if (error) throw error;
      return data as Prodotto[];
    },
  });

  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [search, setSearch] = useState("");
  const [catSel, setCatSel] = useState<string>("tutte");
  const [cartOpen, setCartOpen] = useState(false);
  const [confermato, setConfermato] = useState<{ numero: number; totale: number } | null>(null);

  const totale = useMemo(
    () => Object.values(cart).reduce((s, it) => s + it.prodotto.prezzo * it.quantita, 0),
    [cart],
  );
  const itemCount = useMemo(
    () => Object.values(cart).reduce((s, it) => s + it.quantita, 0),
    [cart],
  );

  const add = (p: Prodotto) =>
    setCart((c) => ({ ...c, [p.id]: { prodotto: p, quantita: (c[p.id]?.quantita ?? 0) + 1 } }));
  const dec = (id: string) =>
    setCart((c) => {
      const q = (c[id]?.quantita ?? 0) - 1;
      if (q <= 0) { const { [id]: _, ...rest } = c; return rest; }
      return { ...c, [id]: { ...c[id], quantita: q } };
    });
  const remove = (id: string) => setCart((c) => { const { [id]: _, ...rest } = c; return rest; });

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    return prodotti.filter((p) => {
      if (catSel !== "tutte" && p.categoria_id !== catSel) return false;
      if (!t) return true;
      return p.nome.toLowerCase().includes(t) || (p.descrizione ?? "").toLowerCase().includes(t);
    });
  }, [prodotti, search, catSel]);

  const grouped = useMemo(() => {
    const map = new Map<string | null, Prodotto[]>();
    for (const p of filtered) {
      const k = p.categoria_id;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(p);
    }
    return map;
  }, [filtered]);

  if (lidoLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Caricamento…
      </div>
    );
  }
  if (lidoErr || !lido) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="card-soft p-6 max-w-md text-center">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-2" />
          <h1 className="text-xl font-semibold text-primary">Lido non trovato</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Il QR potrebbe essere errato o lo stabilimento non è più disponibile.
          </p>
        </div>
      </div>
    );
  }

  if (confermato) {
    return <OrdineConfermato lido={lido} numero={confermato.numero} totale={confermato.totale} onReset={() => { setConfermato(null); setCart({}); }} />;
  }

  return (
    <div className="min-h-screen bg-[color:var(--background)] pb-24">
      <Header lido={lido} ombrellone={ombrelloneParam} />

      <main className="max-w-2xl mx-auto px-4 py-5">
        {!lido.servizio_bar_attivo && (
          <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 p-4 flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Servizio bar non attivo</p>
              <p className="text-sm">Al momento non è possibile inviare ordini.</p>
            </div>
          </div>
        )}

        <div className="sticky top-0 z-20 bg-[color:var(--background)] pt-2 pb-3 -mx-4 px-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cerca nel menu…"
              className="w-full pl-9 pr-3 py-2.5 rounded-full border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            <CatChip label={`Tutte (${prodotti.length})`} active={catSel === "tutte"} onClick={() => setCatSel("tutte")} />
            {categorie.map((c) => {
              const count = prodotti.filter((p) => p.categoria_id === c.id).length;
              if (count === 0) return null;
              return (
                <CatChip key={c.id} label={`${c.nome} (${count})`} active={catSel === c.id} onClick={() => setCatSel(c.id)} />
              );
            })}
          </div>
        </div>

        {prodLoading ? (
          <div className="py-10 text-center text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Caricamento menu…
          </div>
        ) : filtered.length === 0 ? (
          <div className="card-soft p-8 text-center text-muted-foreground">Nessun prodotto disponibile.</div>
        ) : (
          <div className="mt-2 space-y-6">
            {[...grouped.entries()].map(([catId, items]) => {
              const cat = categorie.find((c) => c.id === catId);
              return (
                <section key={catId ?? "senza"}>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-primary mb-2">
                    {cat?.nome ?? "Altro"}
                  </h2>
                  <div className="space-y-2">
                    {items.map((p) => (
                      <ProdottoRow
                        key={p.id}
                        prodotto={p}
                        quantita={cart[p.id]?.quantita ?? 0}
                        onAdd={() => add(p)}
                        onDec={() => dec(p.id)}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>

      {itemCount > 0 && lido.servizio_bar_attivo && (
        <Sheet open={cartOpen} onOpenChange={setCartOpen}>
          <SheetTrigger asChild>
            <button className="fixed bottom-4 left-4 right-4 max-w-2xl mx-auto z-30 bg-primary text-primary-foreground rounded-full shadow-lg px-5 py-3.5 flex items-center justify-between font-semibold">
              <span className="inline-flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                {itemCount} {itemCount === 1 ? "articolo" : "articoli"}
              </span>
              <span>Vedi carrello · € {totale.toFixed(2)}</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl max-h-[92vh] overflow-y-auto">
            <SheetHeader><SheetTitle>Il tuo ordine</SheetTitle></SheetHeader>
            <CartView
              lido={lido}
              cart={cart}
              totale={totale}
              defaultOmbrellone={ombrelloneParam ?? ""}
              onAdd={(id) => add(cart[id].prodotto)}
              onDec={dec}
              onRemove={remove}
              onSubmitted={(numero) => {
                setConfermato({ numero, totale });
                setCartOpen(false);
              }}
            />
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}

function Header({ lido, ombrellone }: { lido: Lido; ombrellone?: string }) {
  return (
    <header className="relative">
      <div className="h-40 bg-gradient-to-br from-[color:var(--primary)] to-[color:var(--teal-deep)] overflow-hidden">
        {lido.foto_copertina_url && (
          <img src={lido.foto_copertina_url} alt="" className="w-full h-full object-cover opacity-80" />
        )}
      </div>
      <div className="max-w-2xl mx-auto px-4 -mt-10 relative">
        <div className="card-soft p-4 flex items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-secondary overflow-hidden shrink-0 ring-2 ring-card">
            {lido.logo_url ? (
              <img src={lido.logo_url} alt={lido.nome} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-primary font-bold">
                {lido.nome.charAt(0)}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-primary truncate">{lido.nome}</h1>
            <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
              {ombrellone && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> Ombrellone {ombrellone}
                </span>
              )}
              {lido.orario_apertura && lido.orario_chiusura && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {lido.orario_apertura.slice(0, 5)} – {lido.orario_chiusura.slice(0, 5)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

function CatChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-3 py-1.5 rounded-full text-sm border transition whitespace-nowrap ${
        active ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function ProdottoRow({
  prodotto, quantita, onAdd, onDec,
}: {
  prodotto: Prodotto;
  quantita: number;
  onAdd: () => void;
  onDec: () => void;
}) {
  return (
    <div className="card-soft p-3 flex items-center gap-3">
      <div className="w-16 h-16 rounded-lg bg-secondary overflow-hidden shrink-0">
        {(prodotto.immagine_url ?? prodotto.foto_url) ? (
          <img src={(prodotto.immagine_url ?? prodotto.foto_url)!} alt={prodotto.nome} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-foreground leading-tight">{prodotto.nome}</h3>
        {prodotto.descrizione && (
          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{prodotto.descrizione}</p>
        )}
        <p className="text-sm font-bold text-primary mt-1">€ {prodotto.prezzo.toFixed(2)}</p>
      </div>
      {quantita === 0 ? (
        <Button onClick={onAdd} size="sm" className="shrink-0 rounded-full h-9 w-9 p-0">
          <Plus className="w-4 h-4" />
        </Button>
      ) : (
        <div className="inline-flex items-center gap-1 shrink-0 bg-primary text-primary-foreground rounded-full p-1">
          <button onClick={onDec} className="w-7 h-7 inline-flex items-center justify-center rounded-full hover:bg-white/15">
            <Minus className="w-4 h-4" />
          </button>
          <span className="min-w-[1.5rem] text-center font-semibold text-sm">{quantita}</span>
          <button onClick={onAdd} className="w-7 h-7 inline-flex items-center justify-center rounded-full hover:bg-white/15">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function CartView({
  lido, cart, totale, defaultOmbrellone, onAdd, onDec, onRemove, onSubmitted,
}: {
  lido: Lido;
  cart: Record<string, CartItem>;
  totale: number;
  defaultOmbrellone: string;
  onAdd: (id: string) => void;
  onDec: (id: string) => void;
  onRemove: (id: string) => void;
  onSubmitted: (numero: number) => void;
}) {
  const [ombrellone, setOmbrellone] = useState(defaultOmbrellone);
  const [telefono, setTelefono] = useState("");
  const [cognome, setCognome] = useState("");
  const [note, setNote] = useState("");
  const [metodoPagamento, setMetodoPagamento] = useState<"contanti" | "carta">("contanti");
  const [sending, setSending] = useState(false);

  useEffect(() => { setOmbrellone(defaultOmbrellone); }, [defaultOmbrellone]);

  const items = Object.values(cart);
  const sopraSoglia = lido.soglia_ordine_libero != null && totale > Number(lido.soglia_ordine_libero);

  const handleSubmit = async () => {
    const ombrTrim = ombrellone.trim();
    const cogTrim = cognome.trim();
    const telTrim = telefono.trim();
    if (!ombrTrim) { toast.error("Inserisci il numero dell'ombrellone"); return; }
    if (!telTrim || telTrim.replace(/\D/g, "").length < 6) { toast.error("Inserisci un numero di telefono valido"); return; }
    if (!cogTrim) { toast.error("Inserisci il cognome"); return; }
    if (items.length === 0) { toast.error("Carrello vuoto"); return; }

    setSending(true);
    const { data: ord, error } = await supabase
      .from("ordini")
      .insert({
        lido_id: lido.id,
        numero_ombrellone: ombrTrim.slice(0, 20),
        cognome: cogTrim.slice(0, 60),
        telefono: telTrim.slice(0, 30),
        totale,
        numero_ordine: 0, // assegnato dal trigger
        note: note.trim() ? note.trim().slice(0, 300) : null,
        metodo_pagamento: lido.accetta_carta ? metodoPagamento : "contanti",
      })
      .select("id, numero_ordine")
      .single();

    if (error || !ord) {
      setSending(false);
      toast.error("Impossibile inviare l'ordine", { description: error?.message });
      return;
    }

    const payload = items.map((it) => ({
      ordine_id: ord.id,
      prodotto_id: it.prodotto.id,
      nome_snapshot: it.prodotto.nome,
      prezzo_snapshot: it.prodotto.prezzo,
      quantita: it.quantita,
    }));
    const { error: itemsErr } = await supabase.from("ordine_items").insert(payload);
    setSending(false);
    if (itemsErr) {
      toast.error("Errore nel salvataggio degli articoli", { description: itemsErr.message });
      return;
    }
    onSubmitted(ord.numero_ordine);
  };

  return (
    <div className="mt-4 space-y-4">
      <div className="space-y-2">
        {items.map((it) => (
          <div key={it.prodotto.id} className="flex items-center gap-3 py-2 border-b border-border last:border-b-0">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{it.prodotto.nome}</p>
              <p className="text-xs text-muted-foreground">€ {it.prodotto.prezzo.toFixed(2)} cad.</p>
            </div>
            <div className="inline-flex items-center gap-1 bg-secondary rounded-full p-0.5">
              <button onClick={() => onDec(it.prodotto.id)} className="w-7 h-7 inline-flex items-center justify-center rounded-full hover:bg-background">
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="min-w-[1.5rem] text-center text-sm font-semibold">{it.quantita}</span>
              <button onClick={() => onAdd(it.prodotto.id)} className="w-7 h-7 inline-flex items-center justify-center rounded-full hover:bg-background">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="w-16 text-right font-semibold text-sm">€ {(it.prodotto.prezzo * it.quantita).toFixed(2)}</div>
            <button onClick={() => onRemove(it.prodotto.id)} className="text-muted-foreground hover:text-destructive p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between text-lg font-bold pt-2 border-t border-border">
        <span>Totale</span>
        <span className="text-primary">€ {totale.toFixed(2)}</span>
      </div>

      {sopraSoglia && (
        <div className="text-xs rounded-lg bg-amber-50 border border-amber-200 text-amber-900 p-2.5">
          L'ordine supera la soglia gratuita di € {Number(lido.soglia_ordine_libero).toFixed(2)}. Il pagamento sarà richiesto alla cassa.
        </div>
      )}

      <div className="space-y-3 pt-2">
        <div>
          <Label htmlFor="omb">Numero ombrellone *</Label>
          <Input id="omb" type="number" inputMode="numeric" value={ombrellone} onChange={(e) => setOmbrellone(e.target.value)}
            maxLength={20} className="mt-1.5" placeholder="es. 42" />
        </div>
        <div>
          <Label htmlFor="tel">Numero di telefono *</Label>
          <Input id="tel" type="tel" inputMode="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)}
            maxLength={30} className="mt-1.5" placeholder="es. 333 1234567" />
        </div>
        <div>
          <Label htmlFor="cog">Cognome *</Label>
          <Input id="cog" value={cognome} onChange={(e) => setCognome(e.target.value)}
            maxLength={60} className="mt-1.5" placeholder="Per riconoscerti alla consegna" />
        </div>
        <div>
          <Label htmlFor="note">Note (opzionale)</Label>
          <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)}
            maxLength={300} rows={2} className="mt-1.5" placeholder="Es. senza ghiaccio…" />
        </div>
        <div>
          <Label>Metodo di pagamento</Label>
          {lido.accetta_carta ? (
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setMetodoPagamento("contanti")}
                className={`h-11 rounded-xl border text-sm font-medium transition ${metodoPagamento === "contanti" ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"}`}>
                Contanti
              </button>
              <button type="button" onClick={() => setMetodoPagamento("carta")}
                className={`h-11 rounded-xl border text-sm font-medium transition ${metodoPagamento === "carta" ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"}`}>
                Carta
              </button>
            </div>
          ) : (
            <p className="mt-1.5 text-sm text-muted-foreground rounded-xl bg-secondary px-3 py-2">
              Pagamento in contanti alla consegna
            </p>
          )}
        </div>
      </div>

      <Button onClick={handleSubmit} disabled={sending} className="w-full h-12 text-base rounded-full">
        {sending ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : null}
        Invia ordine
      </Button>
    </div>
  );
}

function OrdineConfermato({
  lido, numero, totale, onReset,
}: { lido: Lido; numero: number; totale: number; onReset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[color:var(--background)]">
      <div className="card-soft p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-[color:var(--teal)]/20 text-[color:var(--teal-deep)] flex items-center justify-center mb-3">
          <CheckCircle2 className="w-9 h-9" />
        </div>
        <h1 className="text-2xl font-bold text-primary">Ordine inviato!</h1>
        <p className="text-muted-foreground mt-1">Stiamo preparando il tuo ordine.</p>

        <div className="mt-6 rounded-xl bg-secondary p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Numero ordine</p>
          <p className="text-4xl font-bold text-primary mt-1">#{numero}</p>
          <p className="text-sm text-muted-foreground mt-3">Totale: <strong className="text-foreground">€ {totale.toFixed(2)}</strong></p>
        </div>

        <p className="text-xs text-muted-foreground mt-4">
          Il personale di {lido.nome} ti consegnerà l'ordine direttamente al tuo ombrellone.
        </p>

        <Button onClick={onReset} variant="outline" className="mt-6 rounded-full">
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Nuovo ordine
        </Button>
      </div>
    </div>
  );
}
