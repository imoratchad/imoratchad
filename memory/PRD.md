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

## Implemented (2026-02-14)
- **Admin Data Export**: New "📥 Export" tab in Admin Dashboard.
  - Endpoints: `GET /api/admin/export/properties?format=csv|xlsx` and `GET /api/admin/export/users?format=csv|xlsx`.
  - Properties CSV/XLSX include: id, title, type, transaction, price, city/neighborhood/address, rooms, surface, status, verified, featured, views, contact, owner (name/email/role), photos count, rejection reason, created_at.
  - Users CSV/XLSX include: id, name, email, phone, WhatsApp, role, agency, verified_agency, suspended, properties count, created_at, last_login.
  - CSV uses `;` delimiter + UTF-8 BOM (Excel/Sheets friendly, accents preserved).
  - XLSX via `openpyxl` with bold header + auto-sized columns.
  - Filename includes UTC timestamp: `imora_annonces_YYYYMMDD_HHMM.xlsx`.

## Implemented (2026-02-15)
- **Emergent badge removed**: `#emergent-badge` fully removed from `/app/frontend/public/index.html` — no third-party branding on the platform.
- **Email notifications (Resend)**: Backend now sends transactional e-mails to the property owner via Resend on:
  - Approval (`status=active`) — "✓ Votre annonce est publiée"
  - Rejection (`status=rejected`) — includes the rejection reason
  - Verification badge granted (`verified=True`) — "Votre annonce a été vérifiée"
  - Status change (`sold` / `rented`)
  - Non-blocking `asyncio.create_task` so admin API stays instant.
  - IMORA-branded inline-HTML template (orange/cyan gradient header, CTA button linking to `/property/{id}`).
  - Falls back silently to WhatsApp-only when `RESEND_API_KEY` is not set (logs "skipping email").
  - New env vars: `RESEND_API_KEY`, `SENDER_EMAIL` (default `onboarding@resend.dev`), `FRONTEND_PUBLIC_URL`.
- **i18n expansion**: Full FR/EN/AR coverage extended for Publish (validation messages, placeholders, toasts, chooseOption, address, useGps), Archives (badge, subtitle, stats labels, top neighborhoods, filters), Layout nav ("Sold & Rented" / "المُباعة والمؤجرة"), Contact, Map. RTL layout confirmed for Arabic.

## Security Hardening (2026-02-15) — 19/19 pytest ✅
- **SEC-001 [CRITICAL] FIXED**: Admin self-promotion via `PUT /api/auth/profile` blocked. `RoleUpdate.role` now `Literal['particulier','agence','promoteur','demarcheur']` — Pydantic rejects `role='admin'` with HTTP 422. Existing admins cannot demote themselves via profile endpoint.
- **SEC-002 [HIGH] MITIGATED**: `DISABLE_TEST_SESSIONS=1` env guard rejects `test_session_*` tokens in production.
- **SEC-003 [HIGH] APP-LEVEL FIXED**: CORS `allow_origins=["*"]` replaced with `allow_origin_regex` matching only `*.preview.emergentagent.com`, `*.emergent.host`, `imoratchad.com`, `localhost`. NOTE: platform edge (Cloudflare) currently overrides CORS with `*` — infra ticket needed for full enforcement.
- **SEC-004 [MEDIUM] FIXED**: CSV/XLSX formula injection neutralized — `_to_cell` prefixes leading `= + - @ TAB CR` with an apostrophe (CWE-1236).
- **SEC-005 [MEDIUM] FIXED**: `/api/ai/chat` — 1500-char cap (413), empty message (400), sliding-window rate limit **6/min per IP or user** (429).
- **Hardening**: Email template escapes HTML in `title`/`message`/`rejection_reason`; Mongo `$regex` search input escaped + capped at 100 chars (ReDoS defense).

## Pre-Play-Store Hardening (2026-02-16) — 22/22 pytest ✅ (8/8 tasks)
1. **Scam warning banner** — Red alert on every property detail page (`ScamWarningBanner.jsx`) in FR/EN/AR: "Ne versez JAMAIS d'argent par Mobile Money sans avoir visité le bien…".
2. **Report system** — "Signaler cette annonce" button + modal (`ReportModal.jsx`) with 7 reasons (arnaque, fake, prix trompeur, déjà vendu, doublon, inapproprié, autre) + détails + coordonnées facultatives. Backend: `POST /api/properties/{id}/report` (anonymous OK), `GET /api/admin/reports`, `PUT /api/admin/reports/{id}` (open/reviewed/dismissed/actioned). Notifications admin auto-envoyées.
3. **CGU page** — `/terms` avec 12 sections numérotées (Objet, Nature du service, Aucune garantie, Comptes, Publication, Modération, Signalement, Données, PI, Responsabilité, Modif, Contact). Lien footer sur toutes les pages.
4. **WebP compression 100-220KB** — `Publish.jsx` compressImage() détecte support WebP et compresse à 180KB cible (220KB max), fallback JPEG. Économie ~40-60% vs JPEG. Toast affiche format + économie KB.
5. **Cache agressif** — Service worker existant confirmé (registré ; cache-first assets, network-first API). Audit invalidation planifié.
6. **Pagination + Lazy loading** — Search page PAGE_SIZE=12 + bouton "Afficher plus (N restants)". Backend expose `X-Total-Count` header. `PropertyCard` utilise déjà `loading="lazy"` sur images.
7. **GZip compression** — `GZipMiddleware(minimum_size=500, compresslevel=6)` sur toutes les réponses. Content-Encoding: gzip confirmé.
8. **HTTPS + Sécurité** — `SecurityHeadersMiddleware` ajoute HSTS (`max-age=31536000; includeSubDomains; preload`), X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy sur toutes les réponses. Le forced-redirect http→https se configure au niveau DNS/hébergeur pour `imoratchad.com`.

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
