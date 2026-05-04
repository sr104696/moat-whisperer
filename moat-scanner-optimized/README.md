# Moat Scanner - Optimized Version

An AI-powered competitive moat analysis tool for payments companies under $40B market cap.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ or Bun
- Supabase CLI (for deploying edge functions)
- Lovable API key

### Installation

```bash
cd moat-scanner-optimized
npm install
# or
bun install
```

### Environment Setup

Copy `.env` and ensure it contains:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key
LOVABLE_API_KEY=your_lovable_api_key
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Deploy Edge Functions

```bash
supabase functions deploy scan-payments
```

## ✨ New Features

### Search & Filter
- Real-time search by company name, ticker, or tier
- Debounced input for smooth performance

### Sorting Options
- Weighted Score (default)
- Raw Score
- Market Cap
- Alphabetical

### Data Export
- CSV export for spreadsheet analysis
- JSON export for data portability

### Persistence
- Results cached in localStorage for 24 hours
- Automatic cache invalidation
- Manual cache clearing option

### Validation
- Zod schema validation for all API responses
- Type-safe data handling throughout

### Accessibility
- ARIA attributes on interactive elements
- Keyboard navigation support
- Screen reader announcements

## 📁 File Structure

```
src/
├── App.tsx                    # Root with ErrorBoundary
├── components/
│   ├── ui/                    # shadcn/ui components
│   └── ErrorBoundary.tsx      # Error handling
├── hooks/
│   ├── useDebounce.ts         # Debounce utility
│   └── useLocalStorage.ts     # Persistent storage
├── lib/
│   ├── utils.ts               # Utility functions
│   └── validation.ts          # Zod schemas & validators
└── pages/
    └── Index.tsx              # Main scanner component
```

## 🔧 Changes from Original

See [CHANGELOG.md](./CHANGELOG.md) for detailed changes.

### Key Improvements

1. **Error Boundary** - Graceful error handling
2. **Data Validation** - Zod schemas prevent crashes
3. **Caching** - localStorage persistence
4. **Search** - Find companies quickly
5. **Sort** - Multiple sorting options
6. **Export** - Download results as CSV/JSON
7. **Type Safety** - Strict TypeScript enabled
8. **Performance** - Memoization and optimization

## 📝 License

MIT

## ⚠️ Disclaimer

AI-generated estimates only. Not investment advice.
