# ZemiGo Vendor Panel (`zemigo-vendor`)

Standalone responsive web application for **ZemiGo Multi-Vendor Marketplace** sellers, built with **React 19 + TypeScript + Vite + Tailwind CSS + Firebase (Auth, Firestore, Storage)**.

## Key Features

- **Clean White & `#16A34A` Green UI**: Matches the ZemiGo Vendor Panel reference layout across desktop, tablet, and mobile.
- **Focused 5-Item Sidebar Navigation**:
  1. `Dashboard`
  2. `Products`
  3. `Orders`
  4. `Payouts`
  5. `Settings`
- **Strict Per-Vendor Data Isolation**:
  - Every Firestore query (`orders`, `products`, `payouts`, `vendors`) is scoped to the signed-in vendor's `uid`.
  - Multi-vendor customer orders extract **only** the authenticated vendor's `vendor_suborders` / `order_items` revenue and fulfilment status.
  - Enforced server-side via `firestore.rules` and `storage.rules`.
- **Shared Firebase Backend**: Accepts both `VITE_FIREBASE_*` and `EXPO_PUBLIC_FIREBASE_*` environment variables so it shares the same Firebase project as the ZemiGo Customer App (`paryfly`) and Admin Panel (`zemigo-admin`).

## Getting Started

1. Copy `.env.example` to `.env` and fill in your shared ZemiGo Firebase project keys:
   ```bash
   cp .env.example .env
   ```
2. Install dependencies and start the development server (runs on port `5174`):
   ```bash
   npm install
   npm run dev
   ```
3. Typecheck and build for production:
   ```bash
   npm run lint
   npm run build
   ```
