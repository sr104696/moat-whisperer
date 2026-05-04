import { useCallback, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";

type Category = { key: string; name: string; weight: number; inverse: boolean };
type Company = {
  name: string;
  ticker: string;
  market_cap_usd_b: number;
  business_summary: string;
  source_of_moat: string;
  biggest_vulnerability: string;
  tier_changer: string;
  scores: Record<string, number>;
  raw: number;
  weighted: number;
  max_weighted: number;
  pct: number;
  tier: { letter: string; name: string };
};

const tierColor = (l: string) => {
  switch (l) {
    case "S": return "bg-[hsl(var(--tier-s))] text-white";
    case "A": return "bg-[hsl(var(--tier-a))] text-white";
    case "B": return "bg-[hsl(var(--tier-b))] text-primary";
    case "C": return "bg-[hsl(var(--tier-c))] text-white";
    default: return "bg-[hsl(var(--tier-d))] text-white";
  }
};

const normalizeScanData = (data: unknown): { companies: Company[]; categories: Category[] } => {
  const fallback = { companies: [], categories: [] };
  if (!data || typeof data !== "object") return fallback;

  const maybe = data as { companies?: Company[]; categories?: Category[] };
  return {
    companies: Array.isArray(maybe.companies) ? maybe.companies : [],
    categories: Array.isArray(maybe.categories) ? maybe.categories : [],
  };
};

const Index = () => {
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [scanCount, setScanCount] = useState(0);

  const sortedCompanies = useMemo(
    () => [...companies].sort((a, b) => b.pct - a.pct || b.weighted - a.weighted),
    [companies],
  );

  const scan = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("scan-payments");
      if (error) throw error;

      const normalized = normalizeScanData(data);
      setCompanies(normalized.companies);
      setCategories(normalized.categories);
      setScanCount((c) => c + 1);
      setExpanded(null);

      if (!normalized.companies.length) {
        toast.warning("Scan completed but returned no companies");
      } else {
        toast.success(`Scanned ${normalized.companies.length} companies`);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Scan failed";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const ctaLabel = loading ? "Scanning markets" : companies.length ? "Re-run scan" : "Run scan";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="ticker-strip h-2" />
        <div className="container mx-auto px-6 py-8">
          <div className="flex items-baseline justify-between gap-4 flex-wrap">
            <div>
              <div className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">
                Issue №{String(scanCount).padStart(3, "0")} · Live Scan
              </div>
              <h1 className="font-display text-5xl md:text-7xl font-semibold leading-[0.95] tracking-tight">
                The Moat<br />
                <span className="italic text-accent">Scanner</span>
              </h1>
              <p className="mt-4 max-w-xl text-muted-foreground font-mono text-sm">
                Payments companies under <span className="text-foreground font-bold">$40B</span> market cap, scored against a 16-category competitive-moat rubric.
              </p>
            </div>
            <Button
              onClick={scan}
              disabled={loading}
              size="lg"
              className="font-mono uppercase tracking-wider rounded-none border-2 border-foreground bg-accent text-accent-foreground hover:bg-foreground hover:text-background transition-colors h-14 px-8"
            >
              {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <RefreshCw className="mr-2 h-5 w-5" />}
              {ctaLabel}
            </Button>
          </div>
        </div>
      </header>

      {!companies.length && !loading && (
        <section className="grid-bg border-b border-border">
          <div className="container mx-auto px-6 py-24 text-center">
            <p className="font-mono text-sm uppercase tracking-widest text-muted-foreground mb-4">
              No data — press scan to begin
            </p>
            <p className="font-display text-2xl md:text-3xl max-w-2xl mx-auto text-muted-foreground italic">
              Each scan generates a fresh, AI-curated set of sub-$40B payments names — public &amp; private — ranked by weighted moat score.
            </p>
          </div>
        </section>
      )}

      {loading && !companies.length && (
        <div className="container mx-auto px-6 py-24 text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-accent" />
          <p className="mt-6 font-mono uppercase text-sm tracking-widest text-muted-foreground">
            Analyzing 16 categories across 8 candidates…
          </p>
        </div>
      )}

      {sortedCompanies.length > 0 && (
        <main className="container mx-auto px-6 py-12">
          <div className="flex items-baseline justify-between mb-6 border-b-2 border-foreground pb-2">
            <h2 className="font-display text-2xl font-semibold">Ranked by Weighted Score</h2>
            <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
              {sortedCompanies.length} entrants
            </span>
          </div>

          <div className="space-y-3">
            {sortedCompanies.map((c, i) => {
              const isOpen = expanded === c.name;
              return (
                <Card
                  key={`${c.ticker}-${i}`}
                  className="rounded-none border-2 border-border hover:border-foreground transition-colors overflow-hidden"
                >
                  <button
                    onClick={() => setExpanded(isOpen ? null : c.name)}
                    className="w-full text-left"
                    aria-expanded={isOpen}
                  >
                    <div className="grid grid-cols-12 gap-4 items-center p-5">
                      <div className="col-span-1 font-display text-3xl font-bold text-muted-foreground">
                        {String(i + 1).padStart(2, "0")}
                      </div>
                      <div className="col-span-12 md:col-span-4">
                        <div className="font-display text-xl font-semibold leading-tight">{c.name}</div>
                        <div className="font-mono text-xs text-muted-foreground mt-1">
                          {c.ticker} · ${c.market_cap_usd_b.toFixed(1)}B
                        </div>
                      </div>
                      <div className="col-span-4 md:col-span-2">
                        <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Tier</div>
                        <Badge className={`${tierColor(c.tier.letter)} rounded-none font-mono text-sm px-3 py-1 mt-1`}>
                          {c.tier.letter} · {c.tier.name}
                        </Badge>
                      </div>
                      <div className="col-span-4 md:col-span-2">
                        <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Weighted</div>
                        <div className="font-display text-2xl font-semibold tabular-nums">
                          {c.pct.toFixed(0)}<span className="text-base text-muted-foreground">%</span>
                        </div>
                      </div>
                      <div className="col-span-3 md:col-span-2">
                        <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Raw</div>
                        <div className="font-mono text-sm tabular-nums">{c.raw}/64</div>
                      </div>
                      <div className="col-span-1 flex justify-end text-muted-foreground">
                        {isOpen ? <ChevronUp /> : <ChevronDown />}
                      </div>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t-2 border-border bg-secondary/40 p-6 space-y-6 animate-in fade-in">
                      <div>
                        <div className="font-mono text-[10px] uppercase tracking-widest text-accent mb-1">Business</div>
                        <p className="font-display text-base">{c.business_summary}</p>
                      </div>

                      <div className="grid md:grid-cols-3 gap-4">
                        <div>
                          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Source of Moat</div>
                          <p className="text-sm">{c.source_of_moat}</p>
                        </div>
                        <div>
                          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Biggest Vulnerability</div>
                          <p className="text-sm">{c.biggest_vulnerability}</p>
                        </div>
                        <div>
                          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">What Would Change the Tier</div>
                          <p className="text-sm">{c.tier_changer}</p>
                        </div>
                      </div>

                      <div>
                        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
                          Category Scores · 0–4 scale {" "}
                          <span className="text-accent">(Hyperscaler is inverse: 4 = no threat)</span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {categories.map((cat) => {
                            const s = c.scores[cat.key] ?? 0;
                            return (
                              <div key={cat.key} className="border border-border p-2 bg-card">
                                <div className="flex items-baseline justify-between gap-2">
                                  <div className="font-mono text-[10px] leading-tight text-muted-foreground">{cat.name}</div>
                                  <div className="font-display text-xl font-bold tabular-nums">{s}</div>
                                </div>
                                <div className="mt-1 h-1 bg-muted">
                                  <div
                                    className="h-full bg-accent"
                                    style={{ width: `${(s / 4) * 100}%` }}
                                  />
                                </div>
                                <div className="font-mono text-[9px] text-muted-foreground mt-1">
                                  w {cat.weight}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </main>
      )}

      <footer className="border-t border-border mt-12">
        <div className="container mx-auto px-6 py-6 font-mono text-[10px] uppercase tracking-widest text-muted-foreground flex justify-between flex-wrap gap-2">
          <span>AI-generated · estimates · not investment advice</span>
          <span>Rubric · 16 categories · weighted</span>
        </div>
        <div className="ticker-strip h-2" />
      </footer>
    </div>
  );
};

export default Index;
