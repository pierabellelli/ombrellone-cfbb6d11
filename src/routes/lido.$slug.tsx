import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ShoppingCart, Plus, Minus, X, Search, Loader2, CheckCircle2, Clock,
  AlertTriangle, MapPin, ArrowLeft, ChevronDown, ChevronUp, Zap, Coffee, Package, ChefHat,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { useI18n } from "@/lib/i18n";

const LS_KEY = "ombrellone.cliente";
type Preferito = { prodotto_id: string; count: number };
type StoredCustomer = { telefono: string; cognome: string; preferiti: Preferito[] };

function readStoredCustomer(): StoredCustomer | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (p && typeof p.telefono === "string" && typeof p.cognome === "string") {
      const preferiti: Preferito[] = Array.isArray(p.preferiti)
        ? p.preferiti.filter((x: any) => x && typeof x.prodotto_id === "string" && typeof x.count === "number")
        : [];
      return { telefono: p.telefono, cognome: p.cognome, preferiti };
    }
  } catch { /* ignore */ }
  return null;
}
function writeStoredCustomer(telefono: string, cognome: string, orderedItems: { prodotto_id: string; quantita: number }[] = []) {
  if (typeof window === "undefined") return;
  const existing = readStoredCustomer();
  const preferitiMap = new Map(existing?.preferiti.map((p) => [p.prodotto_id, p.count]) ?? []);
  for (const it of orderedItems) {
    preferitiMap.set(it.prodotto_id, (preferitiMap.get(it.prodotto_id) ?? 0) + it.quantita);
  }
  const preferiti = [...preferitiMap.entries()]
    .map(([prodotto_id, count]) => ({ prodotto_id, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
  // keep first saved name; only update phone
  const next: StoredCustomer = {
    telefono,
    cognome: existing?.cognome?.trim() ? existing.cognome : cognome,
    preferiti,
  };
  try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
}
function removeStoredFavorite(prodottoId: string) {
  if (typeof window === "undefined") return;
  const existing = readStoredCustomer();
  if (!existing) return;
  const next: StoredCustomer = {
    ...existing,
    preferiti: existing.preferiti.filter((p) => p.prodotto_id !== prodottoId),
  };
  try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
}

type StoredCartItem = { prodotto_id: string; quantita: number };

function cartStorageKey(slug: string) {
  return `ombrellone.cart.${slug}`;
}
function readStoredCart(slug: string): StoredCartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(cartStorageKey(slug));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x: any) => x && typeof x.prodotto_id === "string" && typeof x.quantita === "number");
  } catch { return []; }
}
function writeStoredCart(slug: string, cart: Record<string, CartItem>) {
  if (typeof window === "undefined") return;
  const items: StoredCartItem[] = Object.values(cart).map((it) => ({ prodotto_id: it.prodotto.id, quantita: it.quantita }));
  try { sessionStorage.setItem(cartStorageKey(slug), JSON.stringify(items)); } catch { /* ignore */ }
}
function clearStoredCart(slug: string) {
  if (typeof window === "undefined") return;
  try { sessionStorage.removeItem(cartStorageKey(slug)); } catch { /* ignore */ }
}

const searchSchema = z.object({
  o: z.union([z.string(), z.number()]).transform(String).optional(),
});

export const Route = createFileRoute("/lido/$slug")({
  validateSearch: searchSchema,
  head: ({ params }) => ({
    meta: [
      { title: `Menu · ${params.slug} · OmbrellOne` },
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
  tempo_attesa_attivo: boolean;
  tempo_attesa_minuti: number | null;
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
  const { t } = useI18n();
  const { slug } = Route.useParams();
  const { o: ombrelloneParam } = Route.useSearch();
  const [view, setView] = useState<"landing" | "order" | "track">(ombrelloneParam ? "order" : "landing");

  const { data: lido, isLoading: lidoLoading, error: lidoErr } = useQuery({
    queryKey: ["pub-lido", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lidi")
        .select("id, nome, slug, logo_url, foto_copertina_url, servizio_bar_attivo, orario_apertura, orario_chiusura, soglia_ordine_libero, accetta_carta, tempo_attesa_attivo, tempo_attesa_minuti")
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
  const restoredCartForSlugRef = useRef<string | null>(null);

  useEffect(() => {
    if (restoredCartForSlugRef.current === slug) return;
    if (prodotti.length === 0) return;
    const stored = readStoredCart(slug);
    if (stored.length > 0) {
      const byId = new Map(prodotti.map((p) => [p.id, p]));
      const restored: Record<string, CartItem> = {};
      for (const it of stored) {
        const p = byId.get(it.prodotto_id);
        if (p) restored[p.id] = { prodotto: p, quantita: it.quantita };
      }
      if (Object.keys(restored).length > 0) setCart(restored);
    }
    restoredCartForSlugRef.current = slug;
  }, [prodotti, slug]);

  useEffect(() => {
    if (restoredCartForSlugRef.current !== slug) return;
    writeStoredCart(slug, cart);
  }, [cart, slug]);

  const [search, setSearch] = useState("");
  const [catSel, setCatSel] = useState<string>("tutte");
  const [cartOpen, setCartOpen] = useState(false);
  const [confermato, setConfermato] = useState<{ numero: number; totale: number } | null>(null);
  const [trackPrefill, setTrackPrefill] = useState<TrackPrefill | null>(null);

  const totale = useMemo(
    () => Object.values(cart).reduce((s, it) => s + it.prodotto.prezzo * it.quantita, 0),
    [cart],
  );
  const itemCount = useMemo(
    () => Object.values(cart).reduce((s, it) => s + it.quantita, 0),
    [cart],
  );

  const [cartBump, setCartBump] = useState(false);
  const prevItemCountRef = useRef(itemCount);
  useEffect(() => {
    if (itemCount > prevItemCountRef.current) {
      setCartBump(true);
      const timer = setTimeout(() => setCartBump(false), 250);
      prevItemCountRef.current = itemCount;
      return () => clearTimeout(timer);
    }
    prevItemCountRef.current = itemCount;
  }, [itemCount]);

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

  const [favTick, setFavTick] = useState(0);
  const stored = typeof window !== "undefined" ? readStoredCustomer() : null;
  const favoriti = useMemo(() => {
    if (!stored?.preferiti?.length || prodotti.length === 0) return [];
    const byId = new Map(prodotti.map((p) => [p.id, p]));
    return stored.preferiti
      .map((pref) => byId.get(pref.prodotto_id))
      .filter((p): p is Prodotto => !!p)
      .slice(0, 5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stored, prodotti, favTick]);

  const removeFavorite = (prodottoId: string) => {
    removeStoredFavorite(prodottoId);
    setFavTick((n) => n + 1);
  };

  if (lidoLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> {t("cliente.loading")}
      </div>
    );
  }
  if (lidoErr || !lido) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="card-soft p-6 max-w-md text-center">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-2" />
          <h1 className="text-xl font-semibold text-primary">{t("cliente.notFoundTitle")}</h1>
          <p className="text-sm text-muted-foreground mt-2">
            {t("cliente.notFoundDesc")}
          </p>
        </div>
      </div>
    );
  }

  if (confermato) {
    return (
      <OrdineConfermato
        lido={lido}
        numero={confermato.numero}
        totale={confermato.totale}
        onReset={() => { setConfermato(null); setCart({}); }}
        onTrack={() => { setConfermato(null); setCart({}); setView("track"); }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[color:var(--background)] pb-24">
      <Header lido={lido} ombrellone={ombrelloneParam} />

      <main className="max-w-2xl mx-auto px-4 py-5">
        {view === "landing" && (
          <LandingChoice onOrder={() => setView("order")} onTrack={() => setView("track")} />
        )}

        {view === "track" && (
          <TrackOrderView
            lido={lido}
            onBack={() => setView("landing")}
            prefill={trackPrefill ?? undefined}
          />
        )}

        {view === "order" && (
        <>
        {!lido.servizio_bar_attivo && (
          <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 p-4 flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">{t("cliente.barInactiveTitle")}</p>
              <p className="text-sm">{t("cliente.barInactiveDesc")}</p>
            </div>
          </div>
        )}

        <div className="sticky top-0 z-20 bg-[color:var(--background)] pt-2 pb-3 -mx-4 px-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("cliente.searchPlaceholder")}
              className="w-full pl-9 pr-3 py-2.5 rounded-full border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            <CatChip label={`${t("cliente.allCategories")} (${prodotti.length})`} active={catSel === "tutte"} onClick={() => setCatSel("tutte")} />
            {categorie.map((c) => {
              const count = prodotti.filter((p) => p.categoria_id === c.id).length;
              if (count === 0) return null;
              return (
                <CatChip key={c.id} label={`${c.nome} (${count})`} active={catSel === c.id} onClick={() => setCatSel(c.id)} />
              );
            })}
          </div>
        </div>

        {lido.servizio_bar_attivo && favoriti.length > 0 && (
          <FavoritesSection favoriti={favoriti} cart={cart} onAdd={add} onDec={dec} onRemoveFavorite={removeFavorite} />
        )}

        {prodLoading ? (
          <div className="py-10 text-center text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> {t("cliente.loadingMenu")}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card-soft p-8 text-center text-muted-foreground">{t("cliente.noProducts")}</div>
        ) : (
          <div className="mt-2 space-y-6">
            {[...grouped.entries()].map(([catId, items]) => {
              const cat = categorie.find((c) => c.id === catId);
              return (
                <section key={catId ?? "senza"}>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-primary mb-2">
                    {cat?.nome ?? t("cliente.otherCategory")}
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

        <OrderHistorySection lidoId={lido.id} />
        </>
        )}
      </main>

      {view === "order" && itemCount > 0 && lido.servizio_bar_attivo && (
        <Sheet open={cartOpen} onOpenChange={setCartOpen}>
          <SheetTrigger asChild>
            <button
              className={`fixed bottom-4 left-4 right-4 max-w-2xl mx-auto z-30 bg-primary text-primary-foreground rounded-full shadow-lg px-5 py-3.5 flex items-center justify-between font-semibold transition-transform duration-200 ${cartBump ? "scale-110" : "scale-100"}`}
            >
              <span className="inline-flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                {itemCount} {itemCount === 1 ? t("cliente.item") : t("cliente.items")}
              </span>
              <span>{t("cliente.viewCart")} · € {totale.toFixed(2)}</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl max-h-[92vh] overflow-y-auto">
            <SheetHeader><SheetTitle>{t("cliente.yourOrder")}</SheetTitle></SheetHeader>
            <CartView
              lido={lido}
              cart={cart}
              totale={totale}
              defaultOmbrellone={ombrelloneParam ?? ""}
              prodotti={prodotti}
              categorie={categorie}
              onAdd={(id) => add(cart[id].prodotto)}
              onAddProduct={add}
              onDec={dec}
              onRemove={remove}
              onSubmitted={(numero, telefono, numeroOmbrellone) => {
                setConfermato({ numero, totale });
                setTrackPrefill({
                  numeroOmbrellone,
                  prefix: telefono.prefix,
                  phone: telefono.phone,
                });
                setCart({});
                clearStoredCart(slug);
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
  const { lang, setLang, t } = useI18n();
  return (
    <header className="relative">
      <div className="sticky top-0 z-20 bg-card/95 backdrop-blur border-b border-border">
        <div className="max-w-2xl mx-auto px-3 h-12 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined" && window.history.length > 1) window.history.back();
              else window.location.href = "/";
            }}
            aria-label={t("cliente.back")}
            className="w-9 h-9 -ml-1 inline-flex items-center justify-center rounded-full hover:bg-secondary transition"
          >
            <ArrowLeft className="w-5 h-5 text-primary" />
          </button>
          <div className="flex-1 min-w-0 flex items-center justify-center gap-2">
            {lido.logo_url ? (
              <img src={lido.logo_url} alt={lido.nome} className="w-6 h-6 rounded-full object-cover" />
            ) : null}
            <span className="text-sm font-semibold text-primary truncate">{lido.nome}</span>
          </div>
          <div className="inline-flex rounded-full border border-border bg-card p-0.5 text-xs font-semibold shrink-0">
            <button
              onClick={() => setLang("it")}
              className={`px-2.5 py-1 rounded-full transition ${lang === "it" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >IT</button>
            <button
              onClick={() => setLang("en")}
              className={`px-2.5 py-1 rounded-full transition ${lang === "en" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >EN</button>
          </div>
        </div>
      </div>
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
                  <MapPin className="w-3.5 h-3.5" /> {t("map.umbrella")} {ombrellone}
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

function FavoritesSection({ favoriti, cart, onAdd, onDec, onRemoveFavorite }: {
  favoriti: Prodotto[];
  cart: Record<string, CartItem>;
  onAdd: (p: Prodotto) => void;
  onDec: (id: string) => void;
  onRemoveFavorite: (prodottoId: string) => void;
}) {
  const { t } = useI18n();
  return (
    <section className="mb-5">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-primary">{t("cliente.favorites")}</h2>
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
          <Zap className="w-3 h-3" /> {t("cliente.quickOrder")}
        </span>
      </div>
      <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1">
        {favoriti.map((p) => {
          const quantita = cart[p.id]?.quantita ?? 0;
          return (
            <div key={p.id} className="relative card-soft p-2.5 w-36 shrink-0 flex flex-col">
              <button
                onClick={() => onRemoveFavorite(p.id)}
                aria-label={t("cliente.removeFavorite")}
                className="absolute top-1 right-1 w-5 h-5 inline-flex items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <X className="w-3 h-3" />
              </button>
              <h3 className="text-xs font-semibold text-foreground leading-tight line-clamp-2 min-h-[2.2em] pr-3">{p.nome}</h3>
              <p className="text-xs font-bold text-primary mt-1">€ {p.prezzo.toFixed(2)}</p>
              {quantita === 0 ? (
                <Button onClick={() => onAdd(p)} size="sm" className="mt-2 rounded-full h-10 w-10 p-0 self-center">
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              ) : (
                <div className="mt-2 inline-flex items-center justify-center gap-0.5 bg-primary text-primary-foreground rounded-full p-1 self-center">
                  <button onClick={() => onDec(p.id)} className="w-10 h-10 inline-flex items-center justify-center rounded-full hover:bg-white/15">
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="min-w-[1.25rem] text-center font-semibold text-xs">{quantita}</span>
                  <button onClick={() => onAdd(p)} className="w-10 h-10 inline-flex items-center justify-center rounded-full hover:bg-white/15">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function LandingChoice({ onOrder, onTrack }: { onOrder: () => void; onTrack: () => void }) {
  const { t } = useI18n();
  return (
    <div className="py-8 flex flex-col gap-3">
      <button
        onClick={onOrder}
        className="card-soft p-6 flex items-center gap-4 text-left hover:bg-secondary/40 transition active:scale-[0.99]"
      >
        <ShoppingCart className="w-7 h-7 shrink-0 text-primary" />
        <span className="text-lg font-bold text-primary">{t("cliente.orderButton")}</span>
      </button>
      <button
        onClick={onTrack}
        className="card-soft p-6 flex items-center gap-4 text-left hover:bg-secondary/40 transition active:scale-[0.99]"
      >
        <Package className="w-7 h-7 shrink-0 text-primary" />
        <span className="text-lg font-bold text-primary">{t("cliente.trackButton")}</span>
      </button>
    </div>
  );
}

const UPSELL_DRINK_KEYWORDS = ["bevand", "drink", "bibit", "acqua", "birra", "cocktail", "caff", "vino", "succh"];
const UPSELL_FOOD_KEYWORDS = ["cibo", "salat", "panin", "food", "pizza", "gelat", "dolc", "snack", "patatine", "toast"];

function matchesAnyKeyword(name: string, keywords: string[]): boolean {
  const lower = name.toLowerCase();
  return keywords.some((k) => lower.includes(k));
}

function getUpsellSuggestions(
  prodotti: Prodotto[],
  categorie: Categoria[],
  cart: Record<string, CartItem>,
  limit: number,
): Prodotto[] {
  const available = prodotti.filter((p) => p.disponibile && !cart[p.id]);
  if (available.length === 0) return [];

  const categoriaNomeById = new Map(categorie.map((c) => [c.id, c.nome]));
  const cartCategoryNames = Object.values(cart)
    .map((it) => (it.prodotto.categoria_id ? categoriaNomeById.get(it.prodotto.categoria_id) : null))
    .filter((n): n is string => !!n);

  const cartHasFood = cartCategoryNames.some((n) => matchesAnyKeyword(n, UPSELL_FOOD_KEYWORDS));
  const cartHasDrink = cartCategoryNames.some((n) => matchesAnyKeyword(n, UPSELL_DRINK_KEYWORDS));

  let targetKeywords: string[] | null = null;
  if (cartHasFood && !cartHasDrink) targetKeywords = UPSELL_DRINK_KEYWORDS;
  else if (cartHasDrink && !cartHasFood) targetKeywords = UPSELL_FOOD_KEYWORDS;

  const byPriceAsc = (a: Prodotto, b: Prodotto) => a.prezzo - b.prezzo;

  if (targetKeywords) {
    const complementary = available
      .filter((p) => {
        const catNome = p.categoria_id ? categoriaNomeById.get(p.categoria_id) : null;
        return catNome ? matchesAnyKeyword(catNome, targetKeywords!) : false;
      })
      .sort(byPriceAsc);
    if (complementary.length > 0) return complementary.slice(0, limit);
  }

  return [...available].sort(byPriceAsc).slice(0, limit);
}

const COUNTRY_CODES = [
  { code: "+39", flag: "🇮🇹" },
  { code: "+44", flag: "🇬🇧" },
  { code: "+49", flag: "🇩🇪" },
  { code: "+33", flag: "🇫🇷" },
  { code: "+34", flag: "🇪🇸" },
  { code: "+31", flag: "🇳🇱" },
  { code: "+32", flag: "🇧🇪" },
  { code: "+41", flag: "🇨🇭" },
  { code: "+43", flag: "🇦🇹" },
  { code: "+351", flag: "🇵🇹" },
];

function isValidPhoneDigits(prefix: string, digits: string): boolean {
  if (!digits || !/^\d+$/.test(digits)) return false;
  if (/^(\d)\1+$/.test(digits)) return false; // all same digit
  if (prefix === "+39") return digits.length >= 9 && digits.length <= 10 && digits[0] === "3";
  return digits.length >= 6 && digits.length <= 15;
}

function normalizePhone(prefix: string, digits: string): string {
  return `${prefix}${digits.replace(/[\s-]/g, "")}`;
}

type PhoneFieldValue = { prefix: string; customPrefix: string; phone: string };

function PhoneField({
  value, onChange, error, idPrefix = "phone",
}: {
  value: PhoneFieldValue;
  onChange: (next: PhoneFieldValue) => void;
  error?: boolean;
  idPrefix?: string;
}) {
  const { t } = useI18n();
  return (
    <div>
      <div className="mt-1.5 flex gap-2">
        <select
          value={value.prefix}
          onChange={(e) => onChange({ ...value, prefix: e.target.value })}
          className="px-2 py-2 rounded-lg border border-border bg-card text-sm shrink-0"
        >
          {COUNTRY_CODES.map((c) => (
            <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
          ))}
          <option value="altro">{t("cliente.trackOtherPrefix")}</option>
        </select>
        {value.prefix === "altro" && (
          <input
            value={value.customPrefix}
            onChange={(e) => onChange({ ...value, customPrefix: e.target.value })}
            placeholder={t("cliente.trackPrefixPlaceholder")}
            className="w-24 px-2.5 py-2 rounded-lg border border-border bg-card text-sm"
          />
        )}
        <Input
          id={`${idPrefix}-tel`}
          type="tel"
          inputMode="tel"
          value={value.phone}
          onChange={(e) => onChange({ ...value, phone: e.target.value })}
          placeholder={t("cliente.trackPhonePlaceholder")}
          className="flex-1"
        />
      </div>
      {error && <p className="text-xs text-destructive mt-1">{t("cliente.trackInvalidPhone")}</p>}
    </div>
  );
}

function elapsedFromNow(iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

type TrackOrder = {
  id: string;
  numero_ordine: number;
  totale: number;
  stato: string;
  created_at: string;
  items: { nome_snapshot: string; quantita: number }[];
};

const TRACK_STATO_PILL: Record<string, { bg: string; icon: typeof Clock; labelKey: "cliente.trackStatusArrivati" | "cliente.status.da_evadere" | "cliente.status.consegnati" }> = {
  arrivati: { bg: "bg-blue-100 text-blue-800", icon: Clock, labelKey: "cliente.trackStatusArrivati" },
  da_evadere: { bg: "bg-amber-100 text-amber-800", icon: ChefHat, labelKey: "cliente.status.da_evadere" },
  consegnati: { bg: "bg-emerald-100 text-emerald-800", icon: CheckCircle2, labelKey: "cliente.status.consegnati" },
};

type TrackPrefill = { numeroOmbrellone: string; prefix: string; phone: string };

function TrackOrderView({ lido, onBack, prefill }: { lido: Lido; onBack: () => void; prefill?: TrackPrefill }) {
  const { t } = useI18n();
  const lidoId = lido.id;
  const [numeroOmbrellone, setNumeroOmbrellone] = useState(prefill?.numeroOmbrellone ?? "");
  const [phoneValue, setPhoneValue] = useState<PhoneFieldValue>({
    prefix: prefill?.prefix ?? "+39",
    customPrefix: "",
    phone: prefill?.phone ?? "",
  });
  const [phoneError, setPhoneError] = useState(false);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<TrackOrder[] | null>(null);

  const effectivePrefix = phoneValue.prefix === "altro" ? phoneValue.customPrefix.trim() : phoneValue.prefix;

  const handleSearch = async (overrides?: Partial<{ numeroOmbrellone: string; prefix: string; phone: string }>) => {
    const omb = overrides?.numeroOmbrellone ?? numeroOmbrellone;
    const pfx = overrides?.prefix ?? effectivePrefix;
    const ph = overrides?.phone ?? phoneValue.phone;
    if (!omb.trim()) { toast.error(t("cliente.errUmbrellaRequired")); return; }
    const digits = ph.replace(/[\s-]/g, "");
    if (!isValidPhoneDigits(pfx, digits)) {
      setPhoneError(true);
      return;
    }
    setPhoneError(false);
    setSearching(true);
    const { data, error } = await (supabase.rpc as any)("traccia_ordini_oggi", {
      _lido_id: lidoId,
      _numero_ombrellone: omb.trim(),
      _telefono: normalizePhone(pfx, digits),
    });
    setSearching(false);
    if (error) {
      toast.error(t("cliente.errSubmitFailed"), { description: error.message });
      return;
    }
    setResults((data ?? []) as unknown as TrackOrder[]);
  };

  useEffect(() => {
    if (prefill) {
      void handleSearch({
        numeroOmbrellone: prefill.numeroOmbrellone,
        prefix: prefill.prefix,
        phone: prefill.phone,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="py-4">
      <button onClick={onBack} className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-4 hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> {t("cliente.back")}
      </button>
      <h1 className="text-lg font-bold text-primary mb-4">{t("cliente.trackButton")}</h1>

      <div className="space-y-3">
        <div>
          <Label htmlFor="track-omb">{t("cliente.trackUmbrellaLabel")}</Label>
          <Input
            id="track-omb"
            type="number"
            inputMode="numeric"
            value={numeroOmbrellone}
            onChange={(e) => setNumeroOmbrellone(e.target.value)}
            placeholder={t("cliente.trackUmbrellaPlaceholder")}
            readOnly={!!prefill}
            disabled={!!prefill}
            className={`mt-1.5 ${prefill ? "bg-muted text-muted-foreground" : ""}`}
          />
        </div>
        <div>
          <Label htmlFor="track-tel">{t("cliente.trackPhoneLabel")}</Label>
          <PhoneField idPrefix="track" value={phoneValue} onChange={setPhoneValue} error={phoneError} />
        </div>

        <Button onClick={() => handleSearch()} disabled={searching} className="w-full h-11 rounded-full">
          {searching ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} {t("cliente.trackSubmit")}
        </Button>
      </div>

      {results !== null && (
        <div className="mt-5 space-y-3">
          {results.length === 0 ? (
            <div className="card-soft p-6 text-center text-muted-foreground">{t("cliente.trackNoResults")}</div>
          ) : (
            <>
              {results.every((o) => o.stato === "consegnati") && (
                <div className="card-soft p-4 text-center font-semibold text-emerald-700 bg-emerald-50">
                  {t("cliente.trackAllDelivered")}
                </div>
              )}
              {results.map((o) => {
                const pill = TRACK_STATO_PILL[o.stato] ?? TRACK_STATO_PILL.arrivati;
                const PillIcon = pill.icon;
                return (
                  <div key={o.id} className="card-soft p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-primary">#{String(o.numero_ordine).padStart(3, "0")}</span>
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${pill.bg}`}>
                        <PillIcon className="w-3.5 h-3.5" /> {t(pill.labelKey)}
                      </span>
                    </div>
                    {o.items?.length > 0 && (
                      <ul className="mt-2 text-sm text-muted-foreground space-y-0.5">
                        {o.items.map((it, i) => (
                          <li key={i}>{it.quantita}× {it.nome_snapshot}</li>
                        ))}
                      </ul>
                    )}
                    <div className="mt-2 flex items-center justify-between text-sm">
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <Clock className="w-3.5 h-3.5" /> {elapsedFromNow(o.created_at)}
                      </span>
                      <span className="font-bold text-primary">€ {Number(o.totale).toFixed(2)}</span>
                    </div>
                    {o.stato !== "consegnati" && lido.tempo_attesa_attivo && lido.tempo_attesa_minuti != null && (
                      <p className="mt-2 text-xs text-muted-foreground inline-flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        {t("cliente.estimatedWaitPrefix")}{lido.tempo_attesa_minuti} {t("cliente.estimatedWaitSuffix")}
                      </p>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
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
          <div className="w-full h-full flex items-center justify-center bg-secondary">
            <Coffee className="w-6 h-6 text-muted-foreground" />
          </div>
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
        <Button onClick={onAdd} size="sm" className="shrink-0 rounded-full h-10 w-10 p-0">
          <Plus className="w-4 h-4" />
        </Button>
      ) : (
        <div className="inline-flex items-center gap-1 shrink-0 bg-primary text-primary-foreground rounded-full p-1">
          <button onClick={onDec} className="w-10 h-10 inline-flex items-center justify-center rounded-full hover:bg-white/15">
            <Minus className="w-4 h-4" />
          </button>
          <span className="min-w-[1.5rem] text-center font-semibold text-sm">{quantita}</span>
          <button onClick={onAdd} className="w-10 h-10 inline-flex items-center justify-center rounded-full hover:bg-white/15">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function CartView({
  lido, cart, totale, defaultOmbrellone, prodotti, categorie, onAdd, onAddProduct, onDec, onRemove, onSubmitted,
}: {
  lido: Lido;
  cart: Record<string, CartItem>;
  totale: number;
  defaultOmbrellone: string;
  prodotti: Prodotto[];
  categorie: Categoria[];
  onAdd: (id: string) => void;
  onAddProduct: (p: Prodotto) => void;
  onDec: (id: string) => void;
  onRemove: (id: string) => void;
  onSubmitted: (numero: number, telefono: { prefix: string; phone: string }, numeroOmbrellone: string) => void;
}) {
  const { t } = useI18n();
  const stored = readStoredCustomer();
  const [ombrellone, setOmbrellone] = useState(defaultOmbrellone);
  const [phoneValue, setPhoneValue] = useState<PhoneFieldValue>({ prefix: "+39", customPrefix: "", phone: stored?.telefono ?? "" });
  const [phoneError, setPhoneError] = useState(false);
  const [cognome, setCognome] = useState(stored?.cognome ?? "");
  const [note, setNote] = useState("");
  const [metodoPagamento, setMetodoPagamento] = useState<"contanti" | "carta">("contanti");
  const [sending, setSending] = useState(false);

  useEffect(() => { setOmbrellone(defaultOmbrellone); }, [defaultOmbrellone]);

  const items = Object.values(cart);
  const sopraSoglia = lido.soglia_ordine_libero != null && totale > Number(lido.soglia_ordine_libero);
  const effectivePrefix = phoneValue.prefix === "altro" ? phoneValue.customPrefix.trim() : phoneValue.prefix;

  const upsellSuggestions = useMemo(
    () => (items.length > 0 ? getUpsellSuggestions(prodotti, categorie, cart, 2) : []),
    [prodotti, categorie, cart, items.length],
  );

  const handleSubmit = async () => {
    const ombrTrim = ombrellone.trim();
    const cogTrim = cognome.trim();
    const digits = phoneValue.phone.replace(/[\s-]/g, "");
    if (!ombrTrim) { toast.error(t("cliente.errUmbrellaRequired")); return; }
    if (!isValidPhoneDigits(effectivePrefix, digits)) {
      setPhoneError(true);
      toast.error(t("cliente.errPhoneInvalid"));
      return;
    }
    setPhoneError(false);
    if (!cogTrim) { toast.error(t("cliente.errLastNameRequired")); return; }
    if (items.length === 0) { toast.error(t("cliente.errEmptyCart")); return; }

    const telNormalizzato = normalizePhone(effectivePrefix, digits);

    setSending(true);
    const { data, error } = await (supabase.rpc as any)("create_ordine", {
      _lido_id: lido.id,
      _numero_ombrellone: ombrTrim.slice(0, 20),
      _cognome: cogTrim.slice(0, 60),
      _telefono: telNormalizzato.slice(0, 30),
      _totale: totale,
      _note: note.trim() ? note.trim().slice(0, 300) : null,
      _metodo_pagamento: lido.accetta_carta ? metodoPagamento : "contanti",
      _items: items.map((it) => ({
        prodotto_id: it.prodotto.id,
        nome_snapshot: it.prodotto.nome,
        prezzo_snapshot: it.prodotto.prezzo,
        quantita: it.quantita,
      })),
    });
    setSending(false);

    const ord = data?.[0];
    if (error || !ord) {
      toast.error(t("cliente.errSubmitFailed"), { description: error?.message });
      return;
    }

    writeStoredCustomer(telNormalizzato.slice(0, 30), cogTrim.slice(0, 60), items.map((it) => ({ prodotto_id: it.prodotto.id, quantita: it.quantita })));
    onSubmitted(ord.numero_ordine, { prefix: effectivePrefix, phone: digits }, ombrTrim);
  };

  return (
    <div className="mt-4 space-y-4">
      <div className="space-y-2">
        {items.map((it) => (
          <div key={it.prodotto.id} className="flex items-center gap-3 py-2 border-b border-border last:border-b-0">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{it.prodotto.nome}</p>
              <p className="text-xs text-muted-foreground">€ {it.prodotto.prezzo.toFixed(2)} {t("cliente.each")}</p>
            </div>
            <div className="inline-flex items-center gap-1 bg-secondary rounded-full p-0.5">
              <button onClick={() => onDec(it.prodotto.id)} className="w-10 h-10 inline-flex items-center justify-center rounded-full hover:bg-background">
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="min-w-[1.5rem] text-center text-sm font-semibold">{it.quantita}</span>
              <button onClick={() => onAdd(it.prodotto.id)} className="w-10 h-10 inline-flex items-center justify-center rounded-full hover:bg-background">
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
        <span>{t("map.total")}</span>
        <span className="text-primary">€ {totale.toFixed(2)}</span>
      </div>

      {sopraSoglia && (
        <div className="text-xs rounded-lg bg-amber-50 border border-amber-200 text-amber-900 p-2.5">
          {t("cliente.overThresholdPrefix")} {Number(lido.soglia_ordine_libero).toFixed(2)}. {t("cliente.overThresholdSuffix")}
        </div>
      )}

      <div className="space-y-3 pt-2">
        <div>
          <Label htmlFor="omb">{t("cliente.umbrellaNumberLabel")}</Label>
          <Input id="omb" type="number" inputMode="numeric" value={ombrellone} onChange={(e) => setOmbrellone(e.target.value)}
            maxLength={20} className="mt-1.5" placeholder={t("cliente.umbrellaPlaceholder")} />
        </div>
        <div>
          <Label htmlFor="cart-tel">{t("cliente.phoneLabel")}</Label>
          <PhoneField idPrefix="cart" value={phoneValue} onChange={setPhoneValue} error={phoneError} />
        </div>
        <div>
          <Label htmlFor="cog">{t("cliente.lastNameLabel")}</Label>
          <Input id="cog" value={cognome} onChange={(e) => setCognome(e.target.value)}
            maxLength={60} className="mt-1.5" placeholder={t("cliente.lastNamePlaceholder")} />
        </div>
        <div>
          <Label htmlFor="note">{t("cliente.notesLabel")}</Label>
          <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)}
            maxLength={300} rows={2} className="mt-1.5" placeholder={t("cliente.notesPlaceholder")} />
        </div>
        <div>
          <Label>{t("cust.payment")}</Label>
          {lido.accetta_carta ? (
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setMetodoPagamento("contanti")}
                className={`h-11 rounded-xl border text-sm font-medium transition ${metodoPagamento === "contanti" ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"}`}>
                {t("cust.payCash")}
              </button>
              <button type="button" onClick={() => setMetodoPagamento("carta")}
                className={`h-11 rounded-xl border text-sm font-medium transition ${metodoPagamento === "carta" ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"}`}>
                {t("cust.payCard")}
              </button>
            </div>
          ) : (
            <p className="mt-1.5 text-sm text-muted-foreground rounded-xl bg-secondary px-3 py-2">
              {t("cust.payCashOnly")}
            </p>
          )}
        </div>
      </div>

      {upsellSuggestions.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-bold uppercase tracking-wider text-primary">{t("cliente.upsellTitle")}</h3>
          <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1">
            {upsellSuggestions.map((p) => (
              <div key={p.id} className="card-soft p-3 w-32 shrink-0 flex flex-col">
                <h4 className="text-xs font-semibold text-foreground leading-tight line-clamp-2 min-h-[2.2em]">{p.nome}</h4>
                <p className="text-xs font-bold text-primary mt-1">€ {p.prezzo.toFixed(2)}</p>
                <Button onClick={() => onAddProduct(p)} size="sm" className="mt-2 rounded-full h-8 w-8 p-0 self-center">
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <Button onClick={handleSubmit} disabled={sending} className="w-full h-12 text-base rounded-full">
        {sending ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : null}
        {t("cliente.submitOrder")}
      </Button>
    </div>
  );
}

function OrdineConfermato({
  lido, numero, totale, onReset, onTrack,
}: { lido: Lido; numero: number; totale: number; onReset: () => void; onTrack: () => void }) {
  const { t } = useI18n();
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[color:var(--background)]">
      <div className="card-soft p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-[color:var(--teal)]/20 text-[color:var(--teal-deep)] flex items-center justify-center mb-3">
          <CheckCircle2 className="w-9 h-9" />
        </div>
        <h1 className="text-2xl font-bold text-primary">{t("cliente.orderSentTitle")}</h1>
        <p className="text-muted-foreground mt-1">{t("cliente.orderSentDesc")}</p>

        <div className="mt-6 rounded-xl bg-secondary p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{t("cliente.orderNumberLabel")}</p>
          <p className="text-4xl font-bold text-primary mt-1">#{numero}</p>
          <p className="text-sm text-muted-foreground mt-3">{t("map.total")}: <strong className="text-foreground">€ {totale.toFixed(2)}</strong></p>
          {lido.tempo_attesa_attivo && lido.tempo_attesa_minuti != null && (
            <p className="text-sm text-muted-foreground mt-2 flex items-center justify-center gap-1.5">
              <Clock className="w-4 h-4" />
              {t("cliente.estimatedWaitPrefix")}{lido.tempo_attesa_minuti} {t("cliente.estimatedWaitSuffix")}
            </p>
          )}
        </div>

        <p className="text-xs text-muted-foreground mt-4">
          {t("cliente.deliveryPrefix")} {lido.nome} {t("cliente.deliverySuffix")}
        </p>

        <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
          <Button onClick={onReset} variant="outline" className="rounded-full">
            <ArrowLeft className="w-4 h-4 mr-1.5" /> {t("cliente.newOrder")}
          </Button>
          <Button onClick={onTrack} className="rounded-full">
            {t("cliente.trackOrderButton")}
          </Button>
        </div>
      </div>
    </div>
  );
}

type StoricoOrdine = {
  id: string;
  numero_ordine: number;
  numero_ombrellone: string;
  totale: number;
  stato: string;
  created_at: string;
  ordine_items: { nome_snapshot: string; quantita: number }[];
};

function OrderHistorySection({ lidoId }: { lidoId: string }) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const stored = typeof window !== "undefined" ? readStoredCustomer() : null;

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["cliente-storico", lidoId, stored?.telefono],
    enabled: !!stored?.telefono && !!lidoId,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_order_history", {
        _lido_id: lidoId,
        _telefono: stored!.telefono,
      });
      if (error) throw error;
      return ((data ?? []) as unknown as Array<Omit<StoricoOrdine, "ordine_items"> & { items: StoricoOrdine["ordine_items"] }>).map(
        ({ items, ...o }) => ({ ...o, ordine_items: items }),
      );
    },
  });

  if (!stored) return null;

  const locale = lang === "it" ? "it-IT" : "en-GB";
  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString(locale, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  const statoColor = (s: string) => {
    switch (s) {
      case "arrivati": return "bg-blue-100 text-blue-800 border-blue-200";
      case "da_evadere": return "bg-amber-100 text-amber-900 border-amber-200";
      case "consegnati": return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "annullato": return "bg-red-100 text-red-800 border-red-200";
      default: return "bg-secondary text-foreground border-border";
    }
  };
  const statoLabel = (s: string) => {
    const k = `cliente.status.${s}` as Parameters<typeof t>[0];
    try { return t(k); } catch { return s; }
  };

  return (
    <section className="mt-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full card-soft px-4 py-3 flex items-center justify-between text-left"
      >
        <span className="font-semibold text-primary">{t("cliente.history")}</span>
        {open ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {isLoading ? (
            <div className="card-soft p-4 text-sm text-muted-foreground inline-flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> …
            </div>
          ) : orders.length === 0 ? (
            <div className="card-soft p-4 text-sm text-muted-foreground text-center">
              {t("cliente.noHistory")}
            </div>
          ) : (
            orders.map((o) => (
              <div key={o.id} className="card-soft p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm">
                    <p className="font-semibold text-foreground">
                      #{o.numero_ordine} · {fmtDate(o.created_at)}
                    </p>
                    <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {t("map.umbrella")} {o.numero_ombrellone}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${statoColor(o.stato)}`}>
                    {statoLabel(o.stato)}
                  </span>
                </div>
                {o.ordine_items?.length > 0 && (
                  <ul className="mt-2 text-xs text-muted-foreground space-y-0.5">
                    {o.ordine_items.map((it, i) => (
                      <li key={i}>{it.quantita}× {it.nome_snapshot}</li>
                    ))}
                  </ul>
                )}
                <div className="mt-2 text-sm font-semibold text-primary text-right">
                  € {Number(o.totale).toFixed(2)}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}
