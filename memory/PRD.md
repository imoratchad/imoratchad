# IMORA Tchad — PRD

## Problem Statement
Build IMORA Tchad — a modern, lightweight, fast, mobile-first real-estate platform for Chad. PWA (offline), trilingual FR/EN/AR, GPS map (Leaflet/OSM), AI assistant, verification badges system, multi-role accounts, manual Airtel/Moov payments.

## User Personas
- **Particulier** — Publishes/browses listings, contacts sellers.
- **Agence immobilière** — Manages portfolio, verified badge.
- **Promoteur immobilier** — Publishes projects.
- **Admin** (`imoratchad@gmail.com`) — Validates listings, manages users/payments, grants verification badges.

## Architecture
- **Backend**: FastAPI + MongoDB (Motor), Pydantic v2. All routes prefixed `/api`. Emergent Auth (Google OAuth via `/auth/v1/env/oauth/session-data`). Cookie + Bearer fallback. AI via Claude Sonnet 4-6 (Emergent Universal Key).
- **Frontend**: React 19 + Tailwind + Shadcn primitives + react-router 7. Leaflet/OSM map. i18next (FR/EN/AR with RTL). PWA service worker (network-first API, cache-first assets). Sonner toasts.
- **Design**: Light Swiss theme, Outfit/Manrope fonts, Brand orange `#FF6B1A` + cyan `#00B4FF` on white + dark `#0A0A0A` header. Chad flag stripe at top.

## Implemented (2026-02-13)
- Auth: Emergent Google OAuth, role assignment, admin auto-promotion.
- Properties: CRUD, search/filter (city, arrondissement, quartier, type, transaction, price, area, verified, q), favorites, view tracking, contact tracking.
- Listing: 5-step publish form with photo compression (canvas, max 1200px, JPEG 0.7), GPS, video upload, multi-document upload, location visibility (exact/quartier/approximate).
- Detail: Photo carousel, Leaflet map, contact buttons (call/WhatsApp/email), verified badge.
- Dashboard (user): My listings, favorites, profile (role + phone + WhatsApp + agency name), stats.
- Admin: Stats (users, agencies, properties, verified, active sessions, revenue), users moderation (role/suspend/verify-agency), property moderation (verify/feature/status), payments validation, feedback inbox.
- AI Assistant: Floating chat, Claude Sonnet 4-6, French-first, context-aware (top 15 active listings injected), property link detection.
- Map page: All geo-located listings on Leaflet/OSM with orange markers + user GPS position.
- Payments: Manual Airtel/Moov workflow with instructions, form (type/amount/method/TXN id/payer phone/note), user history.
- Feedback: Star rating + 4 categories + name/email/phone + message.
- Contact: All channels (WhatsApp, Phone, Email, TikTok, Instagram, Facebook).
- i18n: Full FR/EN/AR translations + RTL for Arabic.
- PWA: Manifest + Service Worker (offline-first cache).
- Mobile bottom nav, sticky desktop header, Chad flag stripe.

## Backlog
- P1: Real-time messaging (WebSocket) — currently REST CRUD only.
- P1: Email/SMS notifications on listing verification.
- P2: Visite virtuelle 360° (planned for v2).
- P2: Agency analytics charts (Recharts already installed).
- P2: Push notifications via PWA.
- P2: Stripe payment alternative for diaspora.

## Next Tasks
- Add a few demo properties for marketing visualization.
- SEO meta tags per page (helmet).
- Image lazy + intersection observer for very low connection.
