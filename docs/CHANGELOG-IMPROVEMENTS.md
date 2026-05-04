# Moat Whisperer Improvements Changelog

## Date
2026-05-04

## What was changed

### 1) Hardened scan response handling
- Added `normalizeScanData` to safely handle malformed or partial edge-function payloads.
- Prevents runtime exceptions if `companies` or `categories` are missing or not arrays.

### 2) Improved ranking consistency
- Added deterministic client-side sorting by `pct` and tie-break on `weighted`.
- Ensures list order remains stable and predictable even if backend order drifts.

### 3) Better React rendering behavior
- Wrapped scan action in `useCallback` and derived sorted results in `useMemo`.
- Reduced avoidable recalculation and stabilizes callback identity for future extraction into child components.

### 4) Improved error handling
- Removed `any` from catch handling and converted to safe `unknown` + `instanceof Error` parsing.
- Added explicit user warning if scan completes with zero companies.

### 5) Accessibility and key robustness
- Added `aria-expanded` to accordion trigger button.
- Updated list key from concatenated name/index to ticker/index pattern for lower collision risk.

## Rationale
- The page depended on optimistic assumptions about API payload shape; this is brittle in production.
- Ranking should reflect the intended rubric, independent of transport order.
- Better memoization and callback stability reduce noisy rerenders as UI grows.
- Safer type handling improves reliability and future refactoring confidence.

## Issues found, fixes applied
- **Issue:** Potential crash when function response contains unexpected structure.  
  **Fix:** `normalizeScanData` fallback strategy.
- **Issue:** Ordering could be inconsistent between scans with equivalent payload content.  
  **Fix:** Explicit sort before render.
- **Issue:** Catch block used `any`.  
  **Fix:** `unknown` + guarded error extraction.

## Suggestions for next performance work
1. Virtualize the company list for larger scan sizes (e.g., `@tanstack/react-virtual`).
2. Cache scan results keyed by timestamp in React Query instead of local component state.
3. Defer rendering of expanded detail sections using dynamic import/suspense if payload grows.
4. Add edge-function response compression when company narratives are long.

## Suggestions to make it more feature-rich
1. Add scan filters (market cap range, geography, public/private toggle).
2. Add sort toggles (weighted, raw, moat stability, vulnerability risk).
3. Add historical scan snapshots and trend deltas by company.
4. Add export actions (CSV/PDF) and shareable links for each scan result.
5. Add confidence/quality score per AI-generated statement.

## How to fix similar problems in future
- Validate all external payloads at boundaries before state updates.
- Derive UI ordering and aggregates in one explicit layer (memoized selectors).
- Keep user-facing async flows with three states: loading, success-empty, success-populated/error.
- Prefer strict TypeScript patterns (`unknown` over `any`) in exception and API paths.
