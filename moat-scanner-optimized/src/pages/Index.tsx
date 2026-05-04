import { useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, RefreshCw, ChevronDown, ChevronUp, Search, Download, X } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { validateScanResult, type Company, type Category } from "@/lib/validation";

type SortOption = "weighted" | "raw" | "marketCap" | "alphabetical";

const CACHE_KEY = "moat-scanner-results";
const CACHE_TIMESTAMP_KEY = "moat-scanner-timestamp";
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

const tierColor = (l: string) => {
  switch (l) {
    case "S": return "bg-[hsl(var(--tier-s))] text-white";
    case "A": return "bg-[hsl(var(--tier-a))] text-white";
    case "B": return "bg-[hsl(var(--tier-b))] text-primary";
    case "C": return "bg-[hsl(var(--tier-c))] text-white";
    default:  return "bg-[hsl(var(--tier-d))] text-white";
  }
};

// Memoized Company Card Component
const CompanyCard = ({ 
  company, 
  index, 
  isOpen, 
  onToggle, 
  categories 
}: { 
  company: Company & { pct: number; tier: { letter: string; name: string } };
  index: number;
  isOpen: boolean;
  onToggle: (name: string) => void;
  categories: Category[];
}) => {
  return (
    <Card
      className="rounded-none border-2 border-border hover:border-foreground transition-colors overflow-hidden"
    >
      <button
        onClick={() => onToggle(company.name)}
        className="w-full text-left"
        aria-expanded={isOpen}
        aria-controls={`company-details-${company.name}`}
      >
        <div className="grid grid-cols-12 gap-4 items-center p-5">
          <div className="col-span-1 font-display text-3xl font-bold text-muted-foreground">
            {String(index + 1).padStart(2, "0")}
          </div>
          <div className="col-span-12 md:col-span-4">
            <div className="font-display text-xl font-semibold leading-tight">{company.name}</div>
            <div className="font-mono text-xs text-muted-foreground mt-1">
              {company.ticker} · ${company.market_cap_usd_b.toFixed(1)}B
            </div>
          </div>
          <div className="col-span-4 md:col-span-2">
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Tier</div>
            <Badge className={`${tierColor(company.tier.letter)} rounded-none font-mono text-sm px-3 py-1 mt-1`}>
              {company.tier.letter} · {company.tier.name}
            </Badge>
          </div>
          <div className="col-span-4 md:col-span-2">
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Weighted</div>
            <div className="font-display text-2xl font-semibold tabular-nums">
              {company.pct.toFixed(0)}<span className="text-base text-muted-foreground">%</span>
            </div>
          </div>
          <div className="col-span-3 md:col-span-2">
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Raw</div>
            <div className="font-mono text-sm tabular-nums">{company.raw}/64</div>
          </div>
          <div className="col-span-1 flex justify-end text-muted-foreground">
            {isOpen ? <ChevronUp /> : <ChevronDown />}
          </div>
        </div>
      </button>

      {isOpen && (
        <div 
          id={`company-details-${company.name}`}
          className="border-t-2 border-border bg-secondary/40 p-6 space-y-6 animate-in fade-in"
        >
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-accent mb-1">Business</div>
            <p className="font-display text-base">{company.business_summary}</p>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Source of Moat</div>
              <p className="text-sm">{company.source_of_moat}</p>
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Biggest Vulnerability</div>
              <p className="text-sm">{company.biggest_vulnerability}</p>
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">What Would Change the Tier</div>
              <p className="text-sm">{company.tier_changer}</p>
            </div>
          </div>

          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
              Category Scores · 0–4 scale {" "}
              <span className="text-accent">(Hyperscaler is inverse: 4 = no threat)</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {categories.map((cat) => {
                const s = company.scores[cat.key] ?? 0;
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
};

CompanyCard.displayName = "CompanyCard";

const Index = () => {
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState<(Company & { pct: number; tier: { letter: string; name: string } })[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [scanCount, setScanCount] = useState(0);
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("weighted");
  const debouncedSearch = useDebounce(searchQuery, 300);
  
  // Persistence with localStorage
  const [cachedResults, setCachedResults] = useLocalStorage<typeof companies>(CACHE_KEY, []);
  const [cacheTimestamp, setCacheTimestamp] = useLocalStorage<number>(CACHE_TIMESTAMP_KEY, 0);

  // Load cached results on mount
  useState(() => {
    const now = Date.now();
    if (cachedResults.length > 0 && cacheTimestamp && (now - cacheTimestamp) < CACHE_EXPIRY) {
      setCompanies(cachedResults);
      // Categories would need to be cached separately or reconstructed
      toast.info("Loaded cached scan results");
    }
  });

  const scan = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("scan-payments");
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      // Validate the response
      const validated = validateScanResult({ companies: data.companies, categories: data.categories });
      if (!validated) {
        throw new Error("Invalid data format from API");
      }
      
      const enrichedCompanies = validated.companies.map(c => ({
        ...c,
        raw: c.raw ?? 0,
        weighted: c.weighted ?? 0,
        max_weighted: c.max_weighted ?? 0,
        pct: c.pct ?? 0,
        tier: c.tier ?? { letter: "D", name: "Fragile" }
      }));
      
      setCompanies(enrichedCompanies);
      setCategories(validated.categories);
      setScanCount((c) => c + 1);
      setExpanded(null);
      
      // Cache the results
      setCachedResults(enrichedCompanies);
      setCacheTimestamp(Date.now());
      
      toast.success(`Scanned ${enrichedCompanies.length} companies`);
    } catch (e: any) {
      toast.error(e.message || "Scan failed");
    } finally {
      setLoading(false);
    }
  }, [setCachedResults, setCacheTimestamp]);

  // Filter and sort companies
  const filteredAndSortedCompanies = useMemo(() => {
    let result = [...companies];
    
    // Apply search filter
    if (debouncedSearch) {
      const query = debouncedSearch.toLowerCase();
      result = result.filter(c => 
        c.name.toLowerCase().includes(query) ||
        c.ticker.toLowerCase().includes(query) ||
        c.tier.letter.toLowerCase().includes(query)
      );
    }
    
    // Apply sorting
    result.sort((a, b) => {
      switch (sortBy) {
        case "weighted":
          return b.pct - a.pct;
        case "raw":
          return (b.raw ?? 0) - (a.raw ?? 0);
        case "marketCap":
          return a.market_cap_usd_b - b.market_cap_usd_b;
        case "alphabetical":
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });
    
    return result;
  }, [companies, debouncedSearch, sortBy]);

  const handleToggle = useCallback((name: string) => {
    setExpanded(prev => prev === name ? null : name);
  }, []);

  const exportToCSV = useCallback(() => {
    const headers = ["Rank", "Name", "Ticker", "Market Cap ($B)", "Tier", "Score (%)", "Raw Score"];
    const rows = filteredAndSortedCompanies.map((c, i) => [
      i + 1,
      c.name,
      c.ticker,
      c.market_cap_usd_b.toFixed(1),
      c.tier.letter,
      c.pct.toFixed(0),
      c.raw?.toString() ?? "0"
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `moat-scanner-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported to CSV");
  }, [filteredAndSortedCompanies]);

  const exportToJSON = useCallback(() => {
    const data = JSON.stringify({ companies: filteredAndSortedCompanies, categories }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `moat-scanner-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported to JSON");
  }, [filteredAndSortedCompanies, categories]);

  const clearCache = useCallback(() => {
    setCachedResults([]);
    setCacheTimestamp(0);
    setCompanies([]);
    setCategories([]);
    toast.info("Cache cleared");
  }, [setCachedResults, setCacheTimestamp]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
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
            <div className="flex gap-2 flex-wrap">
              {companies.length > 0 && (
                <>
                  <Button
                    onClick={exportToCSV}
                    variant="outline"
                    size="sm"
                    className="font-mono uppercase tracking-wider rounded-none"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    CSV
                  </Button>
                  <Button
                    onClick={exportToJSON}
                    variant="outline"
                    size="sm"
                    className="font-mono uppercase tracking-wider rounded-none"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    JSON
                  </Button>
                  <Button
                    onClick={clearCache}
                    variant="ghost"
                    size="sm"
                    className="rounded-none"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </>
              )}
              <Button
                onClick={scan}
                disabled={loading}
                size="lg"
                className="font-mono uppercase tracking-wider rounded-none border-2 border-foreground bg-accent text-accent-foreground hover:bg-foreground hover:text-background transition-colors h-14 px-8"
              >
                {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <RefreshCw className="mr-2 h-5 w-5" />}
                {loading ? "Scanning markets" : companies.length ? "Re-run scan" : "Run scan"}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Search and Filter Bar */}
      {companies.length > 0 && (
        <div className="border-b border-border bg-secondary/20">
          <div className="container mx-auto px-6 py-4">
            <div className="flex gap-4 flex-wrap items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search companies..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 rounded-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Sort by:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="font-mono text-sm border border-border bg-background px-3 py-2 rounded-none"
                >
                  <option value="weighted">Weighted Score</option>
                  <option value="raw">Raw Score</option>
                  <option value="marketCap">Market Cap</option>
                  <option value="alphabetical">Alphabetical</option>
                </select>
              </div>
              <div className="font-mono text-xs text-muted-foreground">
                Showing {filteredAndSortedCompanies.length} of {companies.length}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
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

      {/* Results */}
      {companies.length > 0 && (
        <main className="container mx-auto px-6 py-12">
          <div className="flex items-baseline justify-between mb-6 border-b-2 border-foreground pb-2">
            <h2 className="font-display text-2xl font-semibold">Ranked by Weighted Score</h2>
            <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
              {filteredAndSortedCompanies.length} entrants
            </span>
          </div>

          <div className="space-y-3">
            {filteredAndSortedCompanies.map((company, i) => (
              <CompanyCard
                key={company.name}
                company={company}
                index={i}
                isOpen={expanded === company.name}
                onToggle={handleToggle}
                categories={categories}
              />
            ))}
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
