---
name: VinylVault Coding Agent
description: Expert coding agent for the VinylVault vinyl record collection management app. Handles feature development, bug fixes, and refactoring across the React/TypeScript codebase.
---

# VinylVault Coding Agent

## Project Overview

VinylVault is a production-ready vinyl record collection and dealer operating system built as a GitHub Spark application. It combines intelligent cataloging, AI-powered pressing identification, condition tracking, valuation insights, and real-time marketplace bargain discovery across eBay and Discogs.

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite (build via `npx vite build`)
- **UI Components**: Shadcn v4 (Radix UI primitives) with custom vinyl-themed Tailwind CSS styling
- **Icons**: `@phosphor-icons/react` — use Phosphor icons exclusively; do NOT use `lucide-react`
- **State Management**: React hooks + `useSyncExternalStore` for cross-component wallet state
- **AI Services**: OpenAI GPT-4 vision and chat APIs via `src/lib/`
- **Blockchain**: Solana (Metaplex Umi) for NFT minting; MultiversX and Bitcoin Ordinals integrations
- **Storage**: GitHub Spark KV (`@github/spark`) for all persistent data
- **Marketplace APIs**: eBay Finding API and Discogs Marketplace API (browser-side calls)
- **PWA**: `vite-plugin-pwa` (generateSW mode, autoUpdate)

## Repository Structure

```
src/
├── components/          # React UI components (one component per file)
│   ├── ui/              # Shadcn base components (Button, Dialog, Select, etc.)
│   ├── VinylVaultApp.tsx # Root app component with tab navigation
│   ├── CollectionView.tsx
│   ├── BargainsView.tsx
│   ├── SettingsView.tsx
│   └── ...              # Feature dialogs and views
├── hooks/
│   └── use-wallet.ts    # Solana wallet hook (useSyncExternalStore, module-level global)
├── lib/
│   ├── types.ts         # All TypeScript types and interfaces
│   ├── utils.ts         # Shared utilities
│   └── *-service.ts     # Domain service modules (AI, marketplace, NFT, etc.)
├── vite-end.d.ts        # Global type declarations (SolanaWallet, PWA virtual modules)
└── main.tsx             # App entry point
```

## Key Data Models (`src/lib/types.ts`)

- **`CollectionItem`**: Core entity for a vinyl record in a user's collection. Has `artistName`, `releaseTitle`, `format`, `condition` (media + sleeve grade), `estimatedValue`, `status`, `discogsId` (release ID), `discogsReleaseId` (master ID), etc.
- **`WatchlistItem`**: Marketplace watchlist entry for bargain scanning
- **`BargainCard`**: A scored marketplace listing surfaced by the deal scanner
- **`ListingDraft`**: AI-generated marketplace listing draft
- **`MintedNFT`**: Solana NFT record linked to a `CollectionItem`

## Spark KV Storage Keys

- `'vinyl-vault-collection'` → `CollectionItem[]` (the main collection)
- `'vinyl-vault-api-keys'` → `{ pinataJwt, ... }` (Pinata JWT for NFT metadata uploads)
- `'ebay_client_id'` / `'ebay_app_id'` → eBay App ID (both keys, consumed by DealScannerService)

## Coding Conventions

- **TypeScript**: Always use strict types; never use `any` unless unavoidable
- **Imports**: Use path aliases; keep imports organized (React, third-party, local)
- **Icons**: Only `@phosphor-icons/react` — Phosphor equivalents: `CircleNotch` (spinner), `WarningCircle` (alert/error), `Warning` (warning)
- **Components**: Functional components with hooks; no class components
- **Naming**: `CollectionItem` is the canonical type name — do not introduce conflicting `ListingDraft` names in components
- **Wallet globals**: `window.solana`, `window.solflare`, `window.backpack` are declared in `src/vite-end.d.ts` via `SolanaWallet` interface — do not redeclare in individual files
- **Solana signatures**: `umi.sendAndConfirm()` returns `{ signature: Uint8Array }`; convert to base58 string via `base58.deserialize(signature)[0]` from `@metaplex-foundation/umi` — never use `String()` on a `Uint8Array`
- **PWA**: SW registration is handled by `PWAUpdatePrompt` via `virtual:pwa-register/react`

## Build & Type Checking

```bash
npm install          # Install dependencies
npx vite build       # Production build
npx tsc --noEmit     # TypeScript type check (no test suite configured)
npm run lint         # ESLint
npm run dev          # Development server
```

## Boundaries

- Do not commit secrets or API keys into source code
- All API credentials are stored in Spark KV or `localStorage` — never hardcoded
- No backend server — all API calls are made directly from the browser
- Do not modify `package-lock.json` unless explicitly adding/updating a dependency
- Do not add new dependencies without checking for security vulnerabilities first
