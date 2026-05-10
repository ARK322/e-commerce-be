# e-commerce-be — proje dokümantasyonu

Bu dosya, repodaki **kodun ne işe yaradığını** dosya ve kavram bazında özetler. (Kullanıcı isteğiyle oluşturulmuştur.)

## Git notu (geri yükleme)

- Proje **tam sürüme** `main` dalına geçirilerek eski hâline getirildi.
- `learn-from-scratch` üzerindeki çalışma, istenirse `git stash list` ile **stash: "learn-from-scratch WIP"** kaydında durur: `git stash show -p` / `git stash pop` (dikkat: çakışma olabilir).

---

## Teknoloji özeti

| Bileşen | Kullanım |
|---------|----------|
| **Node.js (≥20)** | Çalışma ortamı |
| **TypeScript** | Kaynak dil; `tsc` ile `dist/` |
| **Fastify 5** | HTTP API framework |
| **postgres (postgres.js)** | PostgreSQL istemcisi, parametreli sorgu |
| **Zod** | Ortam değişkeni + HTTP gövde/sorgu doğrulama |
| **@fastify/jwt** | JWT imzalama / doğrulama |
| **@fastify/cors** | Cross-Origin Resource Sharing |
| **Argon2** | Şifre hash (argon2id) |
| **dotenv** | `.env` → `process.env` |

---

## Kök dosyalar

| Dosya | Amaç |
|--------|------|
| `package.json` | Proje adı, `npm` scriptleri, **dependencies** / **devDependencies** listesi. |
| `package-lock.json` | Bağımlılık ağacının kilitli sürümleri; tekrarlanabilir `npm install`. |
| `tsconfig.json` | TypeScript derleyici ayarları: `ES2022`, `NodeNext` modül, `strict`, `outDir: dist`, `rootDir: src`. |
| `.env.example` | Gerekli ortam değişkenlerinin **şablonu** (gerçek sırlar yok). |
| `.env` | Yerel/üretim sırları; **`.gitignore`** ile repoda olmamalı. |
| `.gitignore` | `node_modules/`, `dist/`, `.env` vb. hariç tutulacaklar. |

### `package.json` scriptleri

- **`npm run dev`** — `tsx watch src/index.ts`: TypeScript’i derlemeden çalıştırır, dosya değişiminde yeniler.
- **`npm run build`** — `tsc`: `src/` → `dist/`.
- **`npm start`** — `node dist/index.js` (önce `build` gerekir).
- **`npm run typecheck`** — `tsc --noEmit`: sadece tip kontrolü.

---

## Giriş ve uygulama iskeleti

### `src/index.ts`

1. `import "dotenv/config"` — proje kökündeki `.env` dosyasını okuyup `process.env`’e yükler.
2. `loadEnv()` — `config/env.ts` üzerinden ortamı Zod ile doğrular; hata varsa süreç başlamaz.
3. `buildApp(env)` — `app.ts` içinde Fastify uygulaması, plugin’ler ve route’lar kurulur.
4. `app.listen({ port, host })` — HTTP sunucusunu belirtilen adreste dinletir.
5. `app.log.info(...)` — hangi host/port’ta dinlendiğine dair log.

### `src/app.ts`

- **`createSql(env)`** — `db/client.ts` ile PostgreSQL bağlantı havuzu.
- **`app.decorate("sql", sql)`** — tüm route handler’larda `app.sql` veya eşdeğeri ile SQL erişimi.
- **CORS** — `origin: true` (geniş; üretimde genelde sınırlanır).
- **JWT** — `secret: env.JWT_SECRET` ile imzalama.
- **`app.decorate("authenticate", ...)`** — `request.jwtVerify()`; başarısızsa 401.
- **`app.register(...)`** — modül route’ları: `health` (prefix yok), diğerleri `/v1` altında.
- **`onClose`** — süreç kapanırken `sql.end` ile veritabanı havuzunu temiz kapatma.

### `src/config/env.ts`

- **`envSchema` (Zod):**
  - `DATABASE_URL` — zorunlu, boş olamaz.
  - `JWT_SECRET` — min 32 karakter.
  - `PORT` — pozitif tam sayı, varsayılan `3001`.
  - `HOST` — string, varsayılan `0.0.0.0`.
- **`loadEnv()`** — `process.env` üzerinde `safeParse`; başarısızsa anlamlı hata mesajı ile `throw`.
- **`Env` tipi** — `z.infer` ile şema ile tip güvenliği.

### `src/db/client.ts`

- **`createSql(env)`** — `postgres(DATABASE_URL, { max, idle_timeout, connect_timeout })` ile havuz.
- **`Sql` tipi** — `ReturnType<typeof createSql>`; `sql` şablonları için kullanılır.

---

## TypeScript deklarasyonları (`src/types/`)

### `fastify.d.ts`

Fastify instance’a projeye özel alanların tiplerini ekler:

- **`sql: Sql`** — veritabanı istemcisi.
- **`authenticate`** — JWT doğrulayan `preHandler`.

### `fastify-jwt.d.ts`

`@fastify/jwt` için JWT **payload** ve **`request.user`** şekli: `{ sub: string, role: string }` (`sub` = kullanıcı id’si).

---

## `src/lib/password.ts`

- **`hashPassword`** — Argon2id ile tek yönlü hash (kayıt).
- **`verifyPassword`** — hash ile düz metin karşılaştırma (giriş); hata durumunda `false`.

---

## Modüller (`src/modules/`)

### Ortak desen

- Her modül genelde **`index.ts`** (Fastify `FastifyPluginAsync` = route topluluğu) + isteğe bağlı **`schemas.ts`** (Zod).
- SQL sorguları **`postgres` etiket şablonu** ile: `${değer}` **parametre** olarak bağlanır (klasik SQL enjeksiyonuna karşı güvenli kullanım).

### `health/index.ts`

- **`GET /health`** — `{ ok: true }` (canlılık / yük dengeleyici).

### `categories/index.ts`

- **`GET /v1/categories`** (prefix `app.ts`’te) — `categories` tablosundan aktif kategoriler; `items` dizisi.

### `catalog/`

- **`schemas.ts`** — `productListQuerySchema`: sayfalama (`page`, `limit`), isteğe bağlı `categoryId` (UUID), `q` (arama, max 200 karakter).
- **`index.ts`** (özet):
  - **`GET /v1/catalog/product-listings`** — aktif ürün ilanları, filtre, full-text arama (`search_vector` / `plainto_tsquery`), sayfalama, `total` / `totalPages`.
  - **`GET /v1/catalog/product-listings/:id`** — ilan detayı + `listing_media` (ürün).
  - **`GET /v1/catalog/production-listings`** / **`:id`** — üretim ilanları için benzer mantık + medya.

### `auth/`

- **`schemas.ts`** — `loginBodySchema`; kayıt için alıcı / satıcı ayrı şemalar + `registerBodySchema` (discriminated union, `role` alanı).
- **`service.ts`:**
  - **`registerUser`** — transaction: `users` + `buyer_profiles` veya `seller_profiles`; e-posta benzersiz ihlali PostgreSQL `23505` → `null` (409).
  - **`authenticateUser`** — e-posta, `status === 'active'`, Argon2 doğrulama.
  - **`getMe`** — kullanıcı + role göre profil satırları.
- **`index.ts`:**
  - **`POST /v1/auth/register`** — kayıt, JWT (7 gün), 201.
  - **`POST /v1/auth/login`** — giriş, JWT.
  - **`GET /v1/auth/me`** — `preHandler: authenticate` — mevcut kullanıcı profili.

### `seller/`

- **`schemas.ts`** — yeni ürün ilanı gövdesi (kategori, fiyat, stok, birim vb.).
- **`index.ts`**
  - **`POST /v1/seller/product-listings`** — JWT zorunlu; `role === seller'`; `seller_profiles` eşlemesi; `product_listings` insert, durum **`draft`**.

---

## HTTP yüzeyi (özet)

| Metot | Yol (prefix dahil) | Kimlik | Açıklama |
|--------|----------------------|--------|-----------|
| GET | `/health` | Yok | Sağlık |
| POST | `/v1/auth/register` | Yok | Kayıt + token |
| POST | `/v1/auth/login` | Yok | Giriş + token |
| GET | `/v1/auth/me` | JWT | Oturum kullanıcısı |
| GET | `/v1/categories` | Yok | Kategori listesi |
| GET | `/v1/catalog/product-listings` | Yok | Ürün ilanları listesi |
| GET | `/v1/catalog/product-listings/:id` | Yok | Ürün ilanı detay + medya |
| GET | `/v1/catalog/production-listings` | Yok | Üretim ilanları listesi |
| GET | `/v1/catalog/production-listings/:id` | Yok | Üretim ilanı detay + medya |
| POST | `/v1/seller/product-listings` | JWT + seller | Taslak ürün ilanı |

---

## Veritabanı

Kodda kullanılan tablolar (şema/migration bu repoda olmayabilir; ayrı SQL veya migrasyon gerekir):

`users`, `buyer_profiles`, `seller_profiles`, `categories`, `product_listings`, `production_listings`, `listing_media` — ayrıca katalog sorgularında `search_vector`, `visibility_score`, `listing_status` gibi sütunlar varsayılır.

---

## Güvenlik notları (kısa)

- **`JWT_SECRET`** ve **`DATABASE_URL`** istemciye verilmez; sadece sunucu ortamında.
- Şifreler veritabanında **Argon2 hash** olarak saklanır.
- İstek gövdeleri **Zod** ile doğrulanır; SQL **parametreli** yazılır.
- Üretimde CORS’u **belirli origin**’lerle sınırlamak iyi pratiktir.

---

## Öğrenme dalı (isteğe bağlı)

`learn-from-scratch` dalında sıfırdan iskelet denemeleri yapıldıysa, tam bu dokümantasyondaki yapı **`main`** ile hizalıdır; öğrenme commit’leri başka daldaysa `git branch -a` ile kontrol edin.
