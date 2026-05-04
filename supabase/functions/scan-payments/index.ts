// Edge function: generates a fresh ranked list of payments companies
// under $40B market cap, scored against the Payments Moat Rubric.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CATEGORIES = [
  { key: "system_of_record", name: "System of Record", weight: 1.5, inverse: false },
  { key: "licensing", name: "Licensing & Scheme Membership", weight: 1.0, inverse: false },
  { key: "integrations", name: "Acquirer/Issuer/Processor Integrations", weight: 1.0, inverse: false },
  { key: "network_effects", name: "Two-Sided Network Effects", weight: 1.5, inverse: false },
  { key: "proprietary_data", name: "Proprietary Transaction Data", weight: 1.0, inverse: false },
  { key: "embedded_flows", name: "Embedded in Checkout/Treasury Flows", weight: 1.5, inverse: false },
  { key: "auth_rates", name: "Authorization Rates & Unit Economics", weight: 1.0, inverse: false },
  { key: "hyperscaler_threat", name: "Hyperscaler & Big Tech Threat (inverse)", weight: 1.0, inverse: true },
  { key: "local_methods", name: "Local Payment Method Coverage", weight: 0.5, inverse: false },
  { key: "vertical", name: "Vertical Specialization", weight: 1.0, inverse: false },
  { key: "capital_float", name: "Capital & Float Economics", weight: 1.5, inverse: false },
  { key: "chargeback", name: "Chargeback & Dispute Infrastructure", weight: 0.5, inverse: false },
  { key: "settlement_fx", name: "Settlement Speed & FX Spread", weight: 1.0, inverse: false },
  { key: "distribution", name: "Distribution Channel Lock-in", weight: 1.5, inverse: false },
  { key: "compliance", name: "Compliance & Risk Ops Scale", weight: 1.0, inverse: false },
  { key: "interchange", name: "Interchange & Scheme Fee Leverage", weight: 1.0, inverse: false },
];

const MAX_WEIGHTED = CATEGORIES.reduce((s, c) => s + c.weight * 4, 0);

const RUBRIC_PROMPT = `You are a payments industry analyst. Generate a list of 8 DIFFERENT payments-industry companies (public or private) with estimated market cap or valuation UNDER $40 billion USD. Vary the list — include lesser-known names, geographic diversity (LatAm, Africa, Asia, EU), and a mix of public & private. Avoid mega-caps (Stripe, Visa, Mastercard, PayPal, Adyen, Block/Square are OFF-LIMITS — too big or borderline).

For EACH company, score the 16 categories of the Payments Moat Rubric from 0-4:
0 = N/A/Absent, 1 = Weak, 2 = Average, 3 = Strong, 4 = Dominant.
Category "hyperscaler_threat" is INVERSE: 4 = no threat, 0 = severe threat.

Categories: system_of_record, licensing, integrations, network_effects, proprietary_data, embedded_flows, auth_rates, hyperscaler_threat, local_methods, vertical, capital_float, chargeback, settlement_fx, distribution, compliance, interchange.

Be honest and conservative — never guess high. Each company also needs:
- name, ticker (or "Private"), market_cap_usd_b (number, billions, must be < 40)
- business_summary (2 sentences: what they do, who pays, how they make money)
- source_of_moat (1 sentence)
- biggest_vulnerability (1 sentence)
- tier_changer (1 sentence: one event that would move the tier)

Return ONLY valid JSON matching the tool schema. Generate genuinely different companies each call — be creative.`;

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
              "name", "ticker", "market_cap_usd_b", "business_summary",
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const seed = Math.random().toString(36).slice(2);
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a rigorous payments industry analyst. Output via the provided tool only." },
          { role: "user", content: `${RUBRIC_PROMPT}\n\nVariation seed: ${seed}` },
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
    if (!call) throw new Error("No tool call returned");
    const args = JSON.parse(call.function.arguments);

    const rawCompanies = args.companies || [];
    console.log(`Model returned ${rawCompanies.length} companies`);

    const enriched = rawCompanies
      .filter((c: any) => typeof c.market_cap_usd_b === "number" && c.market_cap_usd_b > 0 && c.market_cap_usd_b < 40)
      .map((c: any) => {
        const raw = CATEGORIES.reduce((s, cat) => s + (c.scores[cat.key] ?? 0), 0);
        const weighted = CATEGORIES.reduce(
          (s, cat) => s + (c.scores[cat.key] ?? 0) * cat.weight, 0
        );
        const pct = (weighted / MAX_WEIGHTED) * 100;
        const t = tier(pct, c.scores.hyperscaler_threat ?? 2);
        return { ...c, raw, weighted, max_weighted: MAX_WEIGHTED, pct, tier: t };
      })
      .sort((a: any, b: any) => b.weighted - a.weighted);

    console.log(`Returning ${enriched.length} after filter`);

    return new Response(
      JSON.stringify({ companies: enriched, categories: CATEGORIES }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
