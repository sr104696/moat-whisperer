// Edge function: generates a fresh ranked list of public companies
// under $40B market cap, scored against a generalized moat rubric.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CATEGORIES = [
  { key: "system_of_record", name: "System of Record Position", weight: 1.5, inverse: false },
  { key: "licensing", name: "Licenses, Permits & Scarcity", weight: 1.0, inverse: false },
  { key: "integrations", name: "Mission-Critical Integrations", weight: 1.0, inverse: false },
  { key: "network_effects", name: "Network Effects", weight: 1.5, inverse: false },
  { key: "proprietary_data", name: "Proprietary Data Advantage", weight: 1.0, inverse: false },
  { key: "embedded_flows", name: "Embedded Workflow Position", weight: 1.5, inverse: false },
  { key: "auth_rates", name: "Unit Economics & Pricing Power", weight: 1.0, inverse: false },
  { key: "hyperscaler_threat", name: "Big Tech / Platform Threat (inverse)", weight: 1.0, inverse: true },
  { key: "local_methods", name: "Local / Channel Coverage", weight: 0.5, inverse: false },
  { key: "vertical", name: "Vertical Specialization", weight: 1.0, inverse: false },
  { key: "capital_float", name: "Capital / Balance Sheet Advantage", weight: 1.5, inverse: false },
  { key: "chargeback", name: "Operational Exception Handling", weight: 0.5, inverse: false },
  { key: "settlement_fx", name: "Speed / Logistics / Cross-Border Edge", weight: 1.0, inverse: false },
  { key: "distribution", name: "Distribution Lock-in", weight: 1.5, inverse: false },
  { key: "compliance", name: "Compliance & Risk Ops Scale", weight: 1.0, inverse: false },
  { key: "interchange", name: "Take-Rate / Fee Pool Control", weight: 1.0, inverse: false },
];

const MAX_WEIGHTED = CATEGORIES.reduce((s, c) => s + c.weight * 4, 0);

const RUBRIC_PROMPT = `You are a rigorous public-equity moat analyst. Your job is to DISCOVER strong competitive moats among ALL PUBLIC COMPANIES under $40B market cap — NOT only payments, fintech, or familiar names.

DISCOVERY PROTOCOL (follow exactly):
1. Silently brainstorm a WIDE candidate universe of at least 100 publicly traded companies with market cap UNDER $40 billion USD across every sector: software, industrials, healthcare, life sciences tools, exchanges/data, insurance, logistics, marketplaces, aerospace/defense, energy services, consumer brands, vertical SaaS, infrastructure, semiconductors, specialty distribution, testing/inspection, chemicals, equipment rental, franchise systems, B2B data, diagnostics, niche manufacturing, and international compounders.
2. Payments/fintech/banks/lenders/wallets/remittance/acquiring/processing are NOT the focus. Include AT MOST ONE such company in the returned list, and only if it clearly beats the non-financial candidates.
3. Use the discovery lens and seed provided by the user to deliberately explore a different part of the market each run. Do not repeat tickers in the user's exclude list.
4. Mentally score every candidate against the 16-category generalized moat rubric below.
5. Return 12 high-scoring companies from that universe. Prioritize the highest weighted moat scores, but diversify enough that repeated scans surface genuinely new public companies rather than the same canonical list.
6. Every returned company MUST have a real stock ticker on a recognized exchange (NYSE, Nasdaq, LSE, Euronext, B3, HKEX, TSX, ASX, NSE/BSE, JSE, TADAWUL, SIX, OMX, TSE, KRX, SGX, IDX, BM, BMV, SZSE/SSE, etc.) and current market cap > $0 and < $40B. NO PRIVATE COMPANIES. NO PRE-IPO. NO SPACS PRE-MERGER. If uncertain a company is public and under $40B, exclude it.

OFF-LIMITS (too big/private/overused): Visa, Mastercard, PayPal, Adyen, Block/Square, Fiserv, FIS, Global Payments, Stripe, Apple, Microsoft, Alphabet, Amazon, Meta, Nvidia, Berkshire Hathaway, JPMorgan, UnitedHealth, Eli Lilly, Novo Nordisk, ASML, TSMC.

SCORING DISCIPLINE — read carefully:
For EACH of the 16 categories, assign an INTEGER 0-4. Use the FULL distribution. Most categories for most companies should land at 1 or 2. A "3" requires a defensible, evidence-backed reason. A "4" should be RARE — reserved for genuine category dominance in that dimension. Do not give a company straight 3s. Do not cluster scores. A typical sub-$40B public company should average 1.4-2.3 weighted; only true outliers exceed 2.7.

Anchors:
- 0 = Absent / not applicable to the business model
- 1 = Weak / commoditized / clearly behind peers
- 2 = Average / table stakes / on par with peers
- 3 = Strong / measurable advantage vs. peers, defensible for 3+ years
- 4 = Dominant / structural moat, hard to dislodge in 5+ years

Category "hyperscaler_threat" is INVERSE: 4 = insulated from Big Tech / dominant platform / state-owned incumbent encroachment, 0 = directly in the crosshairs and losing ground.

Calibration checks before you finalize each company's scores:
- If the company is a thin reseller, distributor, contractor, commodity manufacturer, or services roll-up → most categories should be 0-2.
- If the company has no network effect → network_effects = 0 or 1, never 3+.
- If the company has no capital, balance-sheet, float, inventory, financing, or underwriting edge → capital_float ≤ 1.
- If the company does not control a scarce license, permit, regulatory approval, data right, IP estate, exchange seat, spectrum, route, or hard-to-replicate authorization → licensing ≤ 1.
- If switching costs are low and procurement is price-driven → embedded_flows, system_of_record, and distribution should be ≤ 2.
- Vertical specialization = 4 ONLY if they dominate a clearly defined niche with a durable share lead.

Categories: system_of_record, licensing, integrations, network_effects, proprietary_data, embedded_flows, auth_rates, hyperscaler_threat, local_methods, vertical, capital_float, chargeback, settlement_fx, distribution, compliance, interchange.

Each company also needs:
- name, ticker (REAL exchange ticker, e.g. "NYSE:STNE", "NASDAQ:AFRM", "B3:CIEL3"), market_cap_usd_b (current, in billions, must be > 0 and < 40)
- sector (plain-English sector/industry, e.g. "Life sciences tools", "Industrial software", "Specialty distribution")
- business_summary (2 sentences: what they do, who pays, how they make money)
- source_of_moat (1 sentence — be specific, no clichés)
- biggest_vulnerability (1 sentence — name the actual threat)
- tier_changer (1 sentence: one specific event that would move the tier up or down)

Return ONLY valid JSON via the tool. Be conservative. Differentiate scores across categories — flat score profiles are a red flag and will be rejected. Do not return placeholders, "simulated" tickers, parent-company references, private companies, or anticipated listings.`;

const tool = {
  type: "function",
  function: {
    name: "submit_company_scores",
    description: "Submit scored payments companies",
    parameters: {
      type: "object",
      properties: {
        companies: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              ticker: { type: "string" },
              sector: { type: "string" },
              market_cap_usd_b: { type: "number" },
              business_summary: { type: "string" },
              source_of_moat: { type: "string" },
              biggest_vulnerability: { type: "string" },
              tier_changer: { type: "string" },
              scores: {
                type: "object",
                properties: Object.fromEntries(
                  CATEGORIES.map((c) => [c.key, { type: "integer", minimum: 0, maximum: 4 }])
                ),
                required: CATEGORIES.map((c) => c.key),
                additionalProperties: false,
              },
            },
            required: [
              "name", "ticker", "sector", "market_cap_usd_b", "business_summary",
              "source_of_moat", "biggest_vulnerability", "tier_changer", "scores",
            ],
            additionalProperties: false,
          },
        },
      },
      required: ["companies"],
      additionalProperties: false,
    },
  },
};

function tier(pct: number, hyperscalerScore: number) {
  let t: { letter: string; name: string };
  if (pct >= 80) t = { letter: "S", name: "Fortress" };
  else if (pct >= 65) t = { letter: "A", name: "Durable" };
  else if (pct >= 50) t = { letter: "B", name: "Defensible" };
  else if (pct >= 35) t = { letter: "C", name: "Contested" };
  else t = { letter: "D", name: "Fragile" };
  // Override: severe hyperscaler threat caps tier at B
  if (hyperscalerScore <= 1 && (t.letter === "S" || t.letter === "A")) {
    t = { letter: "B", name: "Defensible" };
  }
  return t;
}

const DISCOVERY_LENSES = [
  "non-US niche software, vertical SaaS, exchanges/data, and testing/inspection businesses",
  "Japan, Korea, Singapore, Australia, India, and Southeast Asia public companies outside mega-cap technology",
  "Europe and UK industrial technology, specialty distribution, healthcare tools, and financial infrastructure",
  "Latin America, MENA, Africa, and emerging-market compounders across sectors",
  "healthcare services, life-sciences tools, medtech, dental/vet, and specialty pharma platforms",
  "aerospace/defense suppliers, logistics infrastructure, energy services, and regulated industrials",
  "consumer brands, marketplaces, education, gaming, and travel platforms with measurable switching costs",
  "small and mid-cap financials, insurance brokers, exchanges, data vendors, and specialty lenders",
];

function hasRealTicker(company: any) {
  const ticker = String(company?.ticker ?? "").trim();
  if (!ticker || /private|simulated|placeholder|anticipated|pre-?ipo|parent|related|majority owned|n\/?a|none|unknown/i.test(ticker)) return false;
  return /^[A-Z0-9 .-]{1,16}:[A-Z0-9.\-]{1,16}$/i.test(ticker);
}

function scoreShapeLooksReal(company: any) {
  const values = CATEGORIES.map((cat) => Number(company?.scores?.[cat.key] ?? -1));
  return values.every((v) => Number.isInteger(v) && v >= 0 && v <= 4) && new Set(values).size >= 3;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    let body: any = {};
    try { body = await req.json(); } catch (_) { body = {}; }
    const excludeTickers = Array.isArray(body.excludeTickers)
      ? body.excludeTickers.map((t: unknown) => String(t).toUpperCase()).slice(0, 80)
      : [];
    const seed = crypto.randomUUID();
    const lens = DISCOVERY_LENSES[Math.floor(Math.random() * DISCOVERY_LENSES.length)];
    const exclusions = excludeTickers.length
      ? `\n\nDO NOT RETURN these recently shown tickers: ${excludeTickers.join(", ")}.`
      : "";
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a rigorous public-equity moat analyst. Output via the provided tool only." },
          { role: "user", content: `${RUBRIC_PROMPT}\n\nDiscovery lens for this run: ${lens}.\nFreshness seed: ${seed}.${exclusions}` },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "submit_company_scores" } },
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      if (res.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (res.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in Workspace settings." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway ${res.status}: ${txt}`);
    }

    const data = await res.json();
    const call = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) {
      console.error("No tool call. Full response:", JSON.stringify(data).slice(0, 2000));
      throw new Error("No tool call returned by model");
    }
    let args: any;
    try {
      args = JSON.parse(call.function.arguments);
    } catch (err) {
      console.error("Failed to parse args:", call.function.arguments?.slice(0, 1000));
      throw new Error("Invalid JSON from model");
    }

    const rawCompanies = args.companies || [];
    console.log(`Model returned ${rawCompanies.length} companies; sample:`, JSON.stringify(rawCompanies[0])?.slice(0, 400));

    const enriched = rawCompanies
      .filter((c: any) => typeof c.market_cap_usd_b === "number" && c.market_cap_usd_b > 0 && c.market_cap_usd_b < 40)
      .filter((c: any) => hasRealTicker(c))
      .filter((c: any) => !excludeTickers.includes(String(c.ticker).toUpperCase()))
      .filter((c: any) => scoreShapeLooksReal(c))
      .map((c: any) => {
        const raw = CATEGORIES.reduce((s, cat) => s + (c.scores[cat.key] ?? 0), 0);
        const weighted = CATEGORIES.reduce(
          (s, cat) => s + (c.scores[cat.key] ?? 0) * cat.weight, 0
        );
        const pct = (weighted / MAX_WEIGHTED) * 100;
        const t = tier(pct, c.scores.hyperscaler_threat ?? 2);
        return { ...c, raw, weighted, max_weighted: MAX_WEIGHTED, pct, tier: t };
      })
      .sort((a: any, b: any) => b.weighted - a.weighted)
      .slice(0, 12);

    console.log(`Returning ${enriched.length} after filter`);

    return new Response(
      JSON.stringify({ companies: enriched, categories: CATEGORIES, lens, seed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
