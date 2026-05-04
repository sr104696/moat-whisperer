import { z } from "zod";

// Category score schema (0-4 scale)
const CategoryScoreSchema = z.object({
  system_of_record: z.number().min(0).max(4),
  licensing: z.number().min(0).max(4),
  integrations: z.number().min(0).max(4),
  network_effects: z.number().min(0).max(4),
  proprietary_data: z.number().min(0).max(4),
  embedded_flows: z.number().min(0).max(4),
  auth_rates: z.number().min(0).max(4),
  hyperscaler_threat: z.number().min(0).max(4),
  local_methods: z.number().min(0).max(4),
  vertical: z.number().min(0).max(4),
  capital_float: z.number().min(0).max(4),
  chargeback: z.number().min(0).max(4),
  settlement_fx: z.number().min(0).max(4),
  distribution: z.number().min(0).max(4),
  compliance: z.number().min(0).max(4),
  interchange: z.number().min(0).max(4),
});

// Company schema
export const CompanySchema = z.object({
  name: z.string().min(1, "Company name is required"),
  ticker: z.string(),
  market_cap_usd_b: z.number().positive("Market cap must be positive").lt(40, "Market cap must be under $40B"),
  business_summary: z.string().min(1, "Business summary is required"),
  source_of_moat: z.string().min(1, "Source of moat is required"),
  biggest_vulnerability: z.string().min(1, "Biggest vulnerability is required"),
  tier_changer: z.string().min(1, "Tier changer is required"),
  scores: CategoryScoreSchema,
  raw: z.number().optional(),
  weighted: z.number().optional(),
  max_weighted: z.number().optional(),
  pct: z.number().optional(),
  tier: z.object({
    letter: z.enum(["S", "A", "B", "C", "D"]),
    name: z.string(),
  }).optional(),
});

// Category schema
export const CategorySchema = z.object({
  key: z.string(),
  name: z.string(),
  weight: z.number(),
  inverse: z.boolean(),
});

// Scan result schema
export const ScanResultSchema = z.object({
  companies: z.array(CompanySchema),
  categories: z.array(CategorySchema),
});

// Types
export type Company = z.infer<typeof CompanySchema>;
export type Category = z.infer<typeof CategorySchema>;
export type Tier = { letter: string; name: string };

/**
 * Validate and parse company data from API
 * @param data - Raw data from API
 * @returns Validated data or null if invalid
 */
export function validateScanResult(data: unknown): { companies: Company[]; categories: Category[] } | null {
  try {
    const result = ScanResultSchema.parse(data);
    return result;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Validation error:", error.errors);
    }
    return null;
  }
}

/**
 * Calculate tier based on percentage score and hyperscaler threat
 */
export function calculateTier(pct: number, hyperscalerScore: number): { letter: string; name: string } {
  let tier: { letter: string; name: string };
  
  if (pct >= 80) tier = { letter: "S", name: "Fortress" };
  else if (pct >= 65) tier = { letter: "A", name: "Durable" };
  else if (pct >= 50) tier = { letter: "B", name: "Defensible" };
  else if (pct >= 35) tier = { letter: "C", name: "Contested" };
  else tier = { letter: "D", name: "Fragile" };
  
  // Override: severe hyperscaler threat caps tier at B
  if (hyperscalerScore <= 1 && (tier.letter === "S" || tier.letter === "A")) {
    tier = { letter: "B", name: "Defensible" };
  }
  
  return tier;
}

/**
 * Calculate raw and weighted scores for a company
 */
export function calculateScores(
  scores: Record<string, number>,
  categories: Category[]
): { raw: number; weighted: number; maxWeighted: number } {
  const raw = categories.reduce((sum, cat) => sum + (scores[cat.key] ?? 0), 0);
  const weighted = categories.reduce((sum, cat) => sum + (scores[cat.key] ?? 0) * cat.weight, 0);
  const maxWeighted = categories.reduce((sum, cat) => sum + cat.weight * 4, 0);
  
  return { raw, weighted, maxWeighted };
}
