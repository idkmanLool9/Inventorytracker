# Voorraadbeheer (Inventory Tracker)

Een mobiele voorraadbeheer-app voor een fysieke winkel, gebouwd met **React Native + Expo**, **TypeScript**, **SQLite**, en **Zustand**. De app is volledig **offline-first** en biedt optionele synchronisatie met **Shopify**.

> UI-taal: Nederlands. Bedrag-formaat: EUR (`nl-NL`).

---

## Functionaliteit

### Productbeheer
- CRUD voor producten (naam, SKU, barcode, categorie, kost-/verkoopprijs, voorraad, min. voorraad, locatie, foto)
- Productvarianten met eigen SKU en voorraad
- Bulk-import via CSV (`src/utils/csv.ts`)

### Voorraadbewegingen
- Barcode-scan om snel producten te vinden of toe te voegen
- Voorraad in (ontvangst), met optionele leverancier en batchnummer
- Voorraad uit (verkoop / verlies / schade) met redencode
- **Batch-scanmodus**: continue scanner, +1 per scan, haptische feedback, undo per regel
- Geleide voorraadtelling die werkelijk vs systeem vergelijkt
- Overplaatsing tussen locaties
- Volledige audit-log van iedere mutatie (timestamp + gebruiker)

### Inzichten
- Dashboard: totale voorraadwaarde, lage voorraad, niet op voorraad, dode voorraad (>90 dagen geen beweging)
- Lijngrafiek voor in/uit-bewegingen (7 dagen), staafdiagram top-verkopers (30 dagen) — via `react-native-chart-kit`
- Push-meldingen voor lage voorraad (te bouwen met `expo-notifications`, hook beschikbaar)

### Shopify-koppeling (optioneel)
- Per winkel aan/uit te zetten in Instellingen → Shopify
- Twee-richtingen-synchronisatie via Shopify Admin REST API (2024-04):
  - Pull: `GET /products.json`, `GET /locations.json`
  - Push: `POST/PUT /products.json`, `POST /inventory_levels/set.json`
- Offline-first: wijzigingen gaan in een lokale `sync_queue`, retry met backoff (max 5 pogingen)
- Conflict resolutie: laatste-schrijver-wint met zichtbare conflict-log
- Locatie-mapping: Shopify-locaties ↔ fysieke winkellocaties in Instellingen → Locatie-mapping
- `inventory_item_id` wordt automatisch op producten/varianten bewaard zodat stock-pushes werken

### Rollen & rechten
- **Eigenaar** ziet financiële gegevens
- **Manager** kan producten en prijzen wijzigen
- **Medewerker** kan scannen en tellen

---

## Projectstructuur

```
src/
├── components/      Herbruikbare UI-componenten
├── db/              SQLite-laag (migraties, queries, seed)
│   ├── index.ts
│   ├── migrations.ts
│   ├── products.ts
│   ├── movements.ts
│   ├── locations.ts
│   ├── users.ts
│   ├── settings.ts
│   ├── insights.ts
│   └── seed.ts
├── navigation/      React Navigation (tabs + stack)
├── screens/         Schermen (Dashboard, ProductList, Scanner, ...)
├── services/
│   └── shopify/     Shopify API-client en sync-engine
├── store/           Zustand-stores (auth, product, shopify)
├── types/           TypeScript types
└── utils/           Helpers (barcode, currency, csv, date)
scripts/
└── seed.ts          CLI seed-script (50 dummy-producten)
tests/               Jest unit-tests
```

---

## Setup

### Vereisten
- Node 18+
- Expo CLI (`npm i -g expo-cli` of via `npx`)
- Voor iOS: macOS + Xcode
- Voor Android: Android Studio + emulator, of een fysiek toestel met Expo Go

### Installatie

```bash
npm install
cp .env.example .env       # vul Shopify-gegevens in (optioneel)
```

### App starten

```bash
npm start          # opent Metro / Expo Dev Tools
npm run ios        # iOS-simulator
npm run android    # Android-emulator
```

Voor een fysiek apparaat: scan de QR-code uit `npm start` met de Expo Go app.

### Database seeden

In de app: ga naar **Instellingen → Voorraad** en gebruik de seed-knop (of haak de helper `seedDummyData()` in op een eigen knop). Voor headless gebruik:

```bash
npm run seed
```

> NB: Het CLI-script doet alleen zin in een Node-omgeving met een expo-sqlite-mock; van binnen de app kun je `seedDummyData()` direct aanroepen.

---

## Environment variables

Zie `.env.example`. De app leest credentials uit het in-app instellingenscherm (Shopify Settings) — `.env` is alleen relevant voor lokale ontwikkeling.

| Variabele | Wat |
|-----------|-----|
| `SHOPIFY_STORE_DOMAIN` | `mijnwinkel.myshopify.com` |
| `SHOPIFY_ADMIN_ACCESS_TOKEN` | Admin API access token (`shpat_...`) |
| `SHOPIFY_API_VERSION` | Standaard `2024-04` |

---

## Tests

```bash
npm test
npm run test:watch
npm run typecheck
```

Test-coverage omvat:
- `tests/stockDelta.test.ts` — pure stock-delta-berekening
- `tests/barcode.test.ts` — EAN-13 validatie + normalisatie
- `tests/currency.test.ts` — EUR parse/format
- `tests/csv.test.ts` — CSV import/export
- `tests/syncEngine.test.ts` — sync-queue retries en conflict-pad

---

## Architectuurnotities

- **Offline-first**: alle schrijfacties gaan naar SQLite. De Shopify-sync werkt asynchroon via een queue (`sync_queue` tabel) — de app blijft volledig functioneel zonder internet.
- **Migraties**: lineair genummerd in `src/db/migrations.ts`. Voeg nieuwe migraties **alleen onderaan** toe; herschrijf bestaande nooit.
- **Conflict resolutie**: `applyRemoteProduct()` vergelijkt timestamps en logt verschillen in `conflict_log`. De UI-laag kan deze tabel zichtbaar maken.
- **Rol-gebaseerde rechten**: helpers in `src/store/authStore.ts` (`canEditProducts`, `canSeeFinancials`) — de UI bepaalt zelf welke knoppen verschijnen.

---

## Volgende stappen

De scaffold is bewust kort gehouden waar verdieping zinvol is. Open vragen:
- Push-notificaties (`expo-notifications`) op lage voorraad
- Echte Shopify OAuth in plaats van handmatige access tokens
- CSV-import-UI (parser staat klaar)
- Foto's uploaden naar Shopify CDN
- Multi-store/multi-location-mapping
