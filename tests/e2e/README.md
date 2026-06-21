# E2E Testler

Tam akış testleri — **gerçek MongoDB**, **gerçek servisler**, yalnızca dış API'ler (mail, Iyzico) mock.

Integration testler (`src/**/*.integration.test.ts`) feature yanında kalır ve servisleri mock'lar. E2E burada, uçtan uca HTTP + DB ile çalışır.

---

## Üç katman farkı

| Katman | Dosya | DB | Servis mock | Ne test eder |
|--------|-------|-----|-------------|--------------|
| Unit | `*.test.ts` | Hayır | Evet | Fonksiyon / guard |
| Integration | `*.integration.test.ts` | Hayır | Evet | Tek route, inject |
| **E2E** | `tests/e2e/**/*.e2e.test.ts` | **Evet** | Sadece dış API | Çok adımlı akış |

---

## Çalıştırma

```bash
# Ayrı test DB (önerilir)
set E2E_MONGO_URI=mongodb://localhost:27017/e-commerce-e2e

npm run test:e2e
```

`E2E_MONGO_URI` yoksa `MONGO_URI` kullanılır. Proje kökündeki `.env` otomatik yüklenir (`npm run test:e2e`). İkisi de yoksa E2E testleri **skip** edilir (`npm test` etkilenmez).

---

## Klasör yapısı

```
tests/e2e/
├── helpers/
│   ├── env.ts       # E2E env + mongo URI
│   ├── setup.ts     # connect DB, buildApp, drop DB
│   ├── fixtures.ts  # register/verify/seed helpers
│   └── mocks.ts     # Resend + Iyzico mock (hoisted)
└── flows/
    ├── buyer-register.e2e.test.ts
    ├── buyer-auth.e2e.test.ts
    ├── buyer-checkout.e2e.test.ts
    └── seller-onboarding.e2e.test.ts
```

---

## İlk akışlar (öncelik sırası)

### 1. `buyer-register` (hazır)

`POST /auth/register` → MongoDB'de user + buyer profili

### 2. `buyer-checkout` (sıradaki)

```
register → verify-email (OTP/helper) → PATCH profile → POST cart/items
→ POST orders → POST payments → POST payments/callback (token)
→ GET orders/:id (status: paid)
```

Seed/helper: onaylı satıcı + ürün + `iyzicoSubMerchantKey` (admin approve mock veya fixture).

### 3. `seller-onboarding`

```
register seller → PATCH profile → admin approve → GET /auth/seller/products/mine
```

---

## Yazım kuralları

1. **`import '../helpers/mocks'`** — test dosyasının en üstünde (mail/Iyzico mock)
2. **`createE2EContext()`** — `beforeAll`; **`destroyE2EContext(app)`** — `afterAll` (DB drop)
3. **`app.inject()`** — gerçek HTTP yerine Fastify inject yeterli (aynı process, gerçek DB)
4. **Unique email/slug** — `Date.now()` ile çakışma önle
5. **Integration'a taşıma** — tek endpoint davranışı E2E'ye yazma; orada kalsın

---

## CI (ileride)

- GitHub Actions: MongoDB service container veya `mongodb-memory-server`
- `npm run test` → unit + integration (hızlı, mock)
- `npm run test:e2e` → ayrı job, gerçek DB

---

## Ödeme E2E notu

Iyzico gerçek sandbox çağrılmaz; `helpers/mocks.ts` checkout + retrieve mock'lar. Callback route'u `app.inject` ile simüle edilir:

```typescript
await app.inject({
  method: 'POST',
  url: '/payments/callback',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  payload: 'token=e2e-checkout-token',
});
```

Beklenen: `302` redirect + order `paid`.
