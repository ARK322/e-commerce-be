# E2E Testler

Tam akış testleri — **gerçek MongoDB**, yalnızca dış API'ler (mail, Iyzico) mock.

Deploy **Railway** üzerinde; CI pipeline yok. Testler lokal veya staging MongoDB ile manuel çalıştırılır.

---

## Üç katman

| Katman | Komut | DB | Ne test eder |
|--------|-------|-----|--------------|
| Unit + integration | `npm test` | Hayır (mock) | Domain + route inject |
| **E2E** | `npm run test:e2e` | **Evet** | Uçtan uca HTTP + DB |

`npm test` E2E içermez. Railway build/deploy sırasında test koşulmaz.

---

## Çalıştırma (lokal)

```bash
# Ayrı test DB önerilir
set E2E_MONGO_URI=mongodb://localhost:27017/e-commerce-e2e

npm run test:e2e
```

`E2E_MONGO_URI` yoksa `MONGO_URI` kullanılır. İkisi de yoksa E2E dosyaları **skip** edilir (`npm test` etkilenmez).

Önce hızlı kontrol:

```bash
npm run typecheck
npm run check:imports
npm test
```

---

## Klasör yapısı

```
tests/e2e/
├── helpers/
│   ├── env.ts       # Mongo URI + test env defaults
│   ├── bootstrap.ts # vitest setup
│   ├── setup.ts     # connect DB, buildApp, drop DB
│   ├── fixtures.ts  # register/verify/seed helpers
│   └── mocks.ts     # Resend + Iyzico mock
└── flows/
    ├── buyer-register.e2e.test.ts
    ├── buyer-auth.e2e.test.ts
    ├── buyer-checkout.e2e.test.ts
    ├── buyer-return-request.e2e.test.ts
    ├── buyer-support.e2e.test.ts
    ├── seller-onboarding.e2e.test.ts
    ├── seller-fulfillment.e2e.test.ts
    ├── admin-finance.e2e.test.ts
    ├── admin-returns.e2e.test.ts
    ├── admin-return-approval.e2e.test.ts
    ├── admin-support.e2e.test.ts
    ├── multi-seller-checkout.e2e.test.ts
    └── partial-refund.e2e.test.ts
```

---

## Yazım kuralları

1. **`import '../helpers/mocks'`** — dosyanın en üstünde
2. **`createE2EContext()`** / **`destroyE2EContext(app)`** — beforeAll / afterAll
3. **`app.inject()`** — gerçek HTTP yerine Fastify inject
4. **Unique email/slug** — `Date.now()` ile çakışma önle
5. Tek endpoint davranışı → `tests/integration-test/` (E2E'ye yazma)

---

## Ödeme callback simülasyonu

```typescript
await app.inject({
  method: 'POST',
  url: '/payments/callback',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  payload: 'token=e2e-checkout-token',
});
```

Iyzico sandbox çağrılmaz; `helpers/mocks.ts` checkout sonucunu mock'lar.
