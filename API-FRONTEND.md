# E-Commerce Backend — Frontend API Rehberi

Bu doküman frontend geliştiriciler için tüm HTTP endpoint'lerini, auth kurallarını ve tipik kullanım akışlarını tek yerde toplar.

---

## Genel Bilgiler

| Konu | Değer |
|------|-------|
| Base URL | Ortam değişkenine göre (ör. `http://localhost:8080` veya Railway URL) |
| Global prefix | Yok — route'lar kökten mount edilir |
| Content-Type | JSON (`application/json`), dosya yüklemelerinde `multipart/form-data` |
| Auth header | `Authorization: Bearer <JWT>` |
| CORS | `CORS_ORIGINS` env ile yapılandırılır |

### Hata formatı

Tüm hatalar şu yapıda döner:

```json
{
  "message": "İnsan okunabilir hata mesajı",
  "details": {}
}
```

`details` opsiyoneldir; validasyon hatalarında ek bilgi içerebilir.

| HTTP Kodu | Anlam |
|-----------|-------|
| 400 | Geçersiz istek / validasyon hatası |
| 401 | Token yok veya geçersiz |
| 403 | Yetkisiz (rol, izin veya onay durumu) |
| 404 | Kayıt bulunamadı |
| 409 | Çakışma (ör. duplicate kayıt) |
| 429 | Rate limit aşıldı |
| 500 | Sunucu hatası |

### Kimlik doğrulama seviyeleri

| Seviye | Açıklama |
|--------|----------|
| **Public** | Token gerekmez |
| **Auth** | Geçerli JWT, herhangi bir rol |
| **Verified** | Auth + e-posta doğrulanmış (admin'ler verify kontrolünden muaf) |
| **Buyer** | Verified + `role=buyer` + aktif buyer profili |
| **Seller (onaylı)** | Verified + `role=seller` + `approvalStatus=approved` |
| **Seller + izin** | Onaylı seller + RBAC izni |
| **Seller owner** | Şirket sahibi |
| **Kurumsal seller** | Kurumsal seller + ekip yönetimi açık |
| **Admin** | Auth + `role=admin` |
| **Admin + izin** | Admin + belirli izin (owner'lar bypass) |
| **Owner** | Admin owner |

---

## Route Haritası

```
/health, /ready, /categories, /products     → Public katalog
/auth/*                                       → Kayıt, giriş, profil
/auth/admin/*                                 → Admin paneli
/auth/seller/*                                → Seller paneli (ürün, ekip, cüzdan)
/cart, /orders, /payments, /support           → Alışveriş akışı
```

> **Önemli:** Buyer checkout ve seller sipariş yönetimi `/auth/seller` altında değil; doğrudan `/orders` ve `/payments` altındadır.

---

## 1. Health (Public)

### `GET /health`

Liveness probe. Sunucu ayakta mı?

- **Auth:** Public
- **Response:** `200 { "status": "ok" }`

### `GET /ready`

Readiness probe. MongoDB bağlantısı ve bekleyen outbox event sayısı.

- **Auth:** Public
- **Response (hazır):** `200 { "status": "ready", "mongo": true, "outboxPending": 0 }`
- **Response (hazır değil):** `503 { "status": "not_ready", "mongo": false }`

---

## 2. Katalog (Public)

### `GET /categories`

Görünür kategori ağacını listeler. Public cache header'ları set edilir.

- **Auth:** Public (rate-limited)
- **Response:** `200 { "categories": Category[] }`

### `GET /categories/:categoryId`

Tek kategori detayı.

- **Auth:** Public
- **Params:** `categoryId` (UUID)
- **Response:** `200 { "category": Category }`

### `GET /categories/:categoryId/paths`

Kategori breadcrumb / üst kategori yolları.

- **Auth:** Public
- **Params:** `categoryId` (UUID)
- **Response:** `200 { "categoryId": "...", "paths": string[][] }`

### `GET /products`

Ürün listesi / arama.

- **Auth:** Public
- **Query:**

| Param | Tip | Açıklama |
|-------|-----|----------|
| `categoryId` | UUID | Kategoriye göre filtre |
| `search` | string (1–200) | Metin araması |
| `page` | number | Sayfa (varsayılan 1) |
| `limit` | number | Sayfa boyutu (1–100, varsayılan 20) |

- **Response:** `200 { "products": Product[], "pagination": { ... } }`

### `GET /products/:productId`

Ürün detay sayfası.

- **Auth:** Public
- **Params:** `productId` (UUID)
- **Response:** `200 { "product": Product }`

---

## 3. Auth — Kayıt & Kurtarma (Public, rate-limited)

### `POST /auth/register`

Yeni kullanıcı kaydı. Doğrulama e-postası gönderilir.

- **Auth:** Public
- **Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass1",
  "role": "buyer" | "seller"
}
```
- **Response:** `201 { "message": "Kayıt talebiniz alındı..." }`
- **Not:** E-posta zaten kayıtlı olsa bile `201` döner (enumeration koruması).

### `POST /auth/login`

Giriş yap, JWT al.

- **Auth:** Public
- **Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass1",
  "rememberMe": false
}
```
- **Response:** `200`
```json
{
  "message": "...",
  "token": "eyJ...",
  "userId": "uuid",
  "role": "buyer" | "seller" | "admin",
  "isEmailVerified": true,
  // role'e göre ek alanlar:
  // buyer: isActive
  // seller: companyId, companyName, sellerType, approvalStatus, permissions, isOwner, member, ...
  // admin: roleId, roleSlug, roleName, permissions, isOwner
}
```

### `POST /auth/verify-email`

E-posta doğrulama + otomatik giriş.

- **Auth:** Public
- **Body (link ile):** `{ "token": "..." }`
- **Body (OTP ile):** `{ "email": "...", "code": "123456" }`
- **Response:** `200 { "message", "token", "userId", "role", "isEmailVerified", ... }`

### `POST /auth/forgot-password`

Şifre sıfırlama e-postası gönder.

- **Auth:** Public
- **Body:** `{ "email": "..." }`
- **Response:** `200 { "message": "..." }` (hesap var/yok fark etmez)

### `POST /auth/reset-password`

Yeni şifre belirle.

- **Auth:** Public
- **Body (link):** `{ "token": "...", "newPassword": "..." }`
- **Body (OTP):** `{ "email": "...", "code": "...", "newPassword": "..." }`
- **Response:** `200 { "message": "Şifre başarıyla sıfırlandı" }`

### `POST /auth/resend-verification`

Doğrulama e-postasını tekrar gönder.

- **Auth:** Public
- **Body:** `{ "email": "..." }`
- **Response:** `200 { "message": "..." }`

---

## 4. Auth — Oturum Açmış Kullanıcı

### `GET /auth/me`

Mevcut oturum bilgisi.

- **Auth:** Verified (herhangi rol)
- **Response:** `200 { "email", "userId", "role", ...roleFields }`

### `GET /auth/profile`

Tam profil (buyer veya seller).

- **Auth:** Verified (admin reddedilir)
- **Response:** `200 { "email", ...roleFields, "profile", "rejectionReason?" }`

### `PATCH /auth/profile`

Profil güncelle. Buyer profili tamamlanınca hesap aktifleşir.

- **Auth:** Verified
- **Body (buyer — kısmi):**
```json
{
  "firstName", "lastName", "phone", "country", "city", "nationalId",
  "deliveryAddress", "corporateAddress", "billingSameAsDelivery", "billingAddress"
}
```
- **Body (seller — kısmi):**
```json
{
  "sellerType", "firstName", "lastName", "phone",
  "authorizedFirstName", "authorizedLastName", "authorizedPhone",
  "companyPhone", "companyType", "companyName", "taxNumber", "taxOffice",
  "country", "city", "district", "companyAddress",
  "bankName", "iban", "accountHolderName",
  "companyDescription", "companyWebsite", "socialMediaLinks"
}
```
- **Response:** `200 { "message", "email", ...profile }`

### `GET /auth/profile/addresses`

Adres defterini listele.

- **Auth:** Verified
- **Response:** `200 { "addresses": Address[] }`

### `POST /auth/profile/addresses`

Yeni adres ekle.

- **Auth:** Verified
- **Body:**
```json
{
  "firstName": "...",
  "lastName": "...",
  "phone": "...",
  "country": "...",
  "city": "...",
  "address": "...",
  "label": "Ev",
  "isDefaultDelivery": false,
  "isDefaultBilling": false
}
```
- **Response:** `201 { "message", "address" }`

### `PATCH /auth/profile/addresses/:addressId`

Adres güncelle.

- **Auth:** Verified
- **Params:** `addressId` (UUID)
- **Body:** Kısmi adres alanları
- **Response:** `200 { "message", "address" }`

### `DELETE /auth/profile/addresses/:addressId`

Adres sil.

- **Auth:** Verified
- **Params:** `addressId` (UUID)
- **Response:** `200 { "message": "Adres silindi" }`

### `POST /auth/profile/documents`

Seller KYC belgesi yükle.

- **Auth:** Verified (seller)
- **Content-Type:** `multipart/form-data`
- **Fields:** `docType` = `taxCertificate` | `signatureCircular` | `companyLogo` + dosya
- **Response:** `200 { "message", "docType", "url", ... }`

### `POST /auth/change-password`

Şifre değiştir (eski token'lar geçersiz olur).

- **Auth:** Verified
- **Body:** `{ "currentPassword": "...", "newPassword": "..." }`
- **Response:** `200 { "message": "..." }`

### `POST /auth/logout`

Mevcut oturumu kapat.

- **Auth:** Auth
- **Response:** `200 { "message": "Çıkış başarılı" }`

### `POST /auth/logout/all`

Tüm oturumları kapat.

- **Auth:** Auth
- **Response:** `200 { "message": "Tüm oturumlar sonlandırıldı" }`

---

## 5. Sepet — `/cart` (Buyer)

### `GET /cart`

Mevcut sepeti getir.

- **Auth:** Buyer
- **Response:** `200 { "cart": Cart }`

### `POST /cart/items`

Sepete ürün ekle veya miktarı güncelle.

- **Auth:** Buyer
- **Body:** `{ "productId": "uuid", "quantity": 1 }`
- **Response:** `200 { "message", "cart" }`

### `PATCH /cart/items/:productId`

Ürün miktarını güncelle.

- **Auth:** Buyer
- **Params:** `productId` (UUID)
- **Body:** `{ "quantity": 2 }`
- **Response:** `200 { "message", "cart" }`

### `DELETE /cart/items/:productId`

Sepetten ürün çıkar.

- **Auth:** Buyer
- **Params:** `productId` (UUID)
- **Response:** `200 { "message", "cart" }`

### `DELETE /cart`

Sepeti tamamen boşalt.

- **Auth:** Buyer
- **Response:** `200 { "message", "cart" }`

---

## 6. Siparişler — `/orders`

### Sipariş durumları

```
pending → paid → shipped → delivered
                ↘ cancelled
```

### Buyer endpoint'leri

#### `GET /orders`

Alıcının siparişlerini listele.

- **Auth:** Buyer
- **Response:** `200 { "orders": Order[] }`

#### `GET /orders/returns`

İade / iptal taleplerini listele.

- **Auth:** Buyer
- **Response:** `200 { "returns": ReturnRequest[] }`

#### `POST /orders`

Sepetten sipariş oluştur.

- **Auth:** Buyer
- **Body:**
```json
{
  "acceptPriceChanges": false,
  "addressId": "uuid"
}
```
- **Response:** `201 { "message", "order" }`
- **Not:** Sipariş `pending` durumunda oluşur; ödeme beklenir.

#### `GET /orders/:orderId`

Sipariş detayı.

- **Auth:** Buyer
- **Params:** `orderId` (UUID)
- **Response:** `200 { "order": Order }`

#### `POST /orders/:orderId/cancel`

Ödenmemiş (`pending`) siparişi iptal et.

- **Auth:** Buyer
- **Params:** `orderId` (UUID)
- **Response:** `200 { "message", "order" }`

#### `POST /orders/:orderId/returns`

İade veya iptal talebi oluştur.

- **Auth:** Buyer
- **Params:** `orderId` (UUID)
- **Body:**
```json
{
  "type": "cancellation" | "return",
  "items": [
    { "productId": "uuid", "quantity": 1, "reason": "opsiyonel" }
  ],
  "buyerNote": "opsiyonel not"
}
```
- **Response:** `201 { "message", "returnRequest" }`

### Seller endpoint'leri

#### `GET /orders/seller`

Satıcının ürünlerini içeren siparişleri listele.

- **Auth:** Seller onaylı + `orders.read` izni
- **Response:** `200 { "orders": Order[] }`

#### `GET /orders/seller/:orderId`

Satıcı perspektifinden sipariş detayı.

- **Auth:** Seller onaylı + `orders.read`
- **Params:** `orderId` (UUID)
- **Response:** `200 { "order": Order }`

#### `POST /orders/:orderId/shipments`

Kargo / takip bilgisi ekle.

- **Auth:** Seller onaylı + `orders.write`
- **Params:** `orderId` (UUID)
- **Body:**
```json
{
  "trackingNumber": "...",
  "carrier": "yurtici" | "aras" | "mng" | "ptt" | "ups" | "dhl" | "other",
  "productIds": ["uuid"],
  "notes": "opsiyonel"
}
```
- **Response:** `201 { "message", "shipment" }`

#### `PATCH /orders/:orderId/status`

Tüm siparişin kargo durumunu güncelle.

- **Auth:** Seller onaylı + `orders.write`
- **Params:** `orderId` (UUID)
- **Body:** `{ "status": "shipped" | "delivered" }`
- **Response:** `200 { "message", "order" }`

#### `PATCH /orders/:orderId/items/:productId/status`

Tek kalem için kargo durumunu güncelle.

- **Auth:** Seller onaylı + `orders.write`
- **Params:** `orderId`, `productId` (UUID)
- **Body:** `{ "status": "shipped" | "delivered" }`
- **Response:** `200 { "message", "order" }`

---

## 7. Ödemeler — `/payments`

### Ödeme durumları

`pending` → `processing` → `completed` | `failed` | `refunded`

### `POST /payments`

Iyzico checkout başlat.

- **Auth:** Buyer
- **Body:** `{ "orderId": "uuid" }`
- **Response:** `201`
```json
{
  "message": "Ödeme sayfasına yönlendiriliyorsunuz",
  "payment": {
    "id", "orderId", "buyerId", "amount", "currency",
    "provider", "externalId", "status", "createdAt", "updatedAt"
  },
  "checkout": {
    "token": "...",
    "paymentPageUrl": "https://...",
    "checkoutFormContent": "..."
  }
}
```
- **Frontend:** `paymentPageUrl`'e yönlendir veya `checkoutFormContent`'i render et.

### `POST /payments/callback`

Iyzico sunucu callback'i. **Frontend'den çağrılmaz.**

- **Auth:** Public (Iyzico tarafından tetiklenir)
- **Response:** `303 Redirect` → frontend success/failure URL'ine

### `GET /payments/order/:orderId`

Sipariş ödeme durumunu sorgula (polling için).

- **Auth:** Buyer
- **Params:** `orderId` (UUID)
- **Response:** `200 { "payment": Payment }` veya `404`

---

## 8. Destek — `/support` (Buyer)

### Ticket durumları

`open` → `waiting_customer` | `waiting_seller` → `resolved` | `closed`

### `GET /support`

Destek taleplerini listele.

- **Auth:** Buyer
- **Query:** `status?`, `orderId?`, `assignedAdminId?`, `limit?` (varsayılan 20), `offset?` (varsayılan 0)
- **Response:** `200 { "tickets": Ticket[], "total": number }`

### `POST /support`

Yeni destek talebi aç.

- **Auth:** Buyer
- **Body:**
```json
{
  "subject": "...",
  "category": "order" | "shipping" | "product" | "account" | "other",
  "orderId": "uuid (opsiyonel)",
  "body": "mesaj içeriği"
}
```
- **Response:** `201 { "message", "ticket", "supportMessage?" }`

### `GET /support/:ticketId`

Ticket detayı.

- **Auth:** Buyer
- **Params:** `ticketId` (UUID)
- **Response:** `200 { "ticket": Ticket }`

### `GET /support/:ticketId/messages`

Ticket mesajlarını listele.

- **Auth:** Buyer
- **Params:** `ticketId` (UUID)
- **Query:** `since?` (ISO tarih), `limit?` (varsayılan 50), `offset?`
- **Response:** `200 { "messages": Message[], "total": number }`

### `POST /support/:ticketId/messages`

Ticket'a cevap yaz.

- **Auth:** Buyer
- **Params:** `ticketId` (UUID)
- **Body:** `{ "body": "..." }`
- **Response:** `201 { "message", "supportMessage" }`

---

## 9. Admin — `/auth/admin/*`

Tüm admin route'ları **Admin** auth gerektirir. İzin gerektirenler ayrıca belirtilmiştir.

### Profil — `/auth/admin/profile`

| Method | Path | Auth | Body | Ne yapar |
|--------|------|------|------|----------|
| GET | `/` | Admin | — | Kendi profilini getir |
| PATCH | `/` | Admin | `{ firstName?, lastName?, phone? }` | Kendi profilini güncelle |
| PATCH | `/:userId` | Admin | profil alanları | Başka admin profilini güncelle |

### Adminler — `/auth/admin/admins`

| Method | Path | Auth | Body | Ne yapar |
|--------|------|------|------|----------|
| GET | `/` | Admin | — | Admin listesi |
| GET | `/:userId` | Admin | — | Admin detayı |
| POST | `/` | Owner | `{ email, password, roleId, firstName?, lastName?, phone? }` | Yeni admin oluştur |
| PATCH | `/:userId` | Owner | `{ roleId }` | Admin rolünü değiştir |
| PATCH | `/:userId/active` | Owner | `{ isActive: boolean }` | Aktif/pasif yap |
| DELETE | `/:userId` | Owner | — | Admin sil |

### Roller — `/auth/admin/roles`

| Method | Path | Auth | Ne yapar |
|--------|------|------|----------|
| GET | `/permissions` | Admin + `adminRoles.read` | İzin listesi |
| GET | `/assignable` | Owner | Yeni admin'e atanabilir roller |
| GET | `/` | Admin + `adminRoles.read` | Tüm roller |
| GET | `/:roleId` | Admin + `adminRoles.read` | Rol detayı |
| POST | `/` | Owner | Rol oluştur |
| PATCH | `/:roleId` | Owner | Rol güncelle |
| DELETE | `/:roleId` | Owner | Rol sil |

### Kategoriler — `/auth/admin/categories`

| Method | Path | Auth | Ne yapar |
|--------|------|------|----------|
| GET | `/` | Admin + `categories.read` | Kategori ağacı |
| GET | `/:categoryId` | Admin + `categories.read` | Kategori detayı |
| POST | `/` | Admin + `categories.write` | Kategori oluştur |
| PATCH | `/:categoryId` | Admin + `categories.write` | Kategori güncelle |
| POST | `/:categoryId/links` | Admin + `categories.write` | Parent/child bağla |
| DELETE | `/:categoryId/links` | Admin + `categories.write` | Bağlantı kaldır |
| DELETE | `/:categoryId` | Admin + `categories.write` | Kategori sil |

**POST body örneği:**
```json
{ "name": "Elektronik", "slug": "elektronik", "parentIds": [], "isActive": true }
```

**Link body:** `{ "parentId": "uuid" }` veya `{ "childId": "uuid" }`

### Satıcılar — `/auth/admin/sellers`

| Method | Path | Auth | Query/Body | Ne yapar |
|--------|------|------|------------|----------|
| GET | `/` | Admin + `sellers.read` | `status?`: draft/pending/approved/rejected | Satıcı listesi |
| GET | `/:userId` | Admin + `sellers.read` | — | Satıcı detayı |
| GET | `/:userId/wallet` | Admin + `sellers.read` | — | Satıcı cüzdanı |
| POST | `/:userId/approve` | Admin + `sellers.approve` | — | Satıcıyı onayla |
| POST | `/:userId/iyzico-sync` | Admin + `sellers.approve` | — | Iyzico alt-üye senkronu |
| POST | `/:userId/reject` | Admin + `sellers.approve` | `{ reason }` | Satıcıyı reddet |
| PATCH | `/:userId/active` | Admin + `sellers.approve` | `{ isActive }` | Aktif/pasif yap |

### Siparişler — `/auth/admin/orders`

| Method | Path | Auth | Query | Ne yapar |
|--------|------|------|-------|----------|
| GET | `/` | Admin + `orders.read` | `status?, buyerId?, sellerId?, limit?, offset?` | Tüm siparişler |
| GET | `/:orderId` | Admin + `orders.read` | — | Sipariş detayı |

### İadeler — `/auth/admin/returns`

**İade durumları:** `pending` → `approved` | `rejected` → `refunded` | `cancelled`

| Method | Path | Auth | Body/Query | Ne yapar |
|--------|------|------|------------|----------|
| GET | `/` | Admin + `returns.read` | `status?, page?, limit?` | İade talepleri listesi |
| PATCH | `/:requestId` | Admin + `returns.write` | `{ decision: "approved"\|"rejected", adminNote? }` | İade talebini değerlendir |

### Alıcılar — `/auth/admin/buyers`

| Method | Path | Auth | Query | Ne yapar |
|--------|------|------|-------|----------|
| GET | `/` | Admin + `buyers.read` | `page?, limit?, search?` | Alıcı listesi |
| GET | `/:userId` | Admin + `buyers.read` | — | Alıcı detayı + sipariş özeti |

### Destek — `/auth/admin/support`

| Method | Path | Auth | Ne yapar |
|--------|------|------|----------|
| GET | `/` | Admin + `support.read` | Tüm ticket'lar (filtrelenebilir) |
| GET | `/:ticketId` | Admin + `support.read` | Ticket detayı |
| GET | `/:ticketId/messages` | Admin + `support.read` | Mesaj listesi |
| POST | `/:ticketId/messages` | Admin + `support.write` | Admin cevabı (`isInternal?` opsiyonel) |
| PATCH | `/:ticketId` | Admin + `support.write` | `{ status?, assignedAdminId? }` güncelle |

### Finans — `/auth/admin/finance`

| Method | Path | Auth | Query | Ne yapar |
|--------|------|------|-------|----------|
| GET | `/summary` | Admin + `finance.read` | `from?, to?, limit?` | Platform gelir özeti |
| GET | `/by-seller` | Admin + `finance.read` | `from?, to?, limit?` | Satıcı bazlı dağılım |
| GET | `/export` | Admin + `finance.export` | `from?, to?` | CSV export (`text/csv`) |

### Audit — `/auth/admin/audit-logs`

| Method | Path | Auth | Query | Ne yapar |
|--------|------|------|-------|----------|
| GET | `/` | Admin | `action?, resourceType?, resourceId?, actorUserId?, limit?, offset?` | Admin işlem geçmişi |

### Ödeme Audit — `/auth/admin/payment-audit-logs`

| Method | Path | Auth | Query | Ne yapar |
|--------|------|------|-------|----------|
| GET | `/` | Admin | `orderId?, paymentId?, limit?, offset?` | Ödeme durum geçişleri |

---

## 10. Seller — `/auth/seller/*`

Ekip yönetimi route'ları **Kurumsal seller** gerektirir (kurumsal + ekip yönetimi açık).

### Üyeler — `/auth/seller/members`

| Method | Path | Auth | Ne yapar |
|--------|------|------|----------|
| GET | `/` | Kurumsal + `members.read` | Ekip listesi |
| GET | `/:userId` | Kurumsal | Üye detayı |
| POST | `/` | Kurumsal + Owner | Üye davet et |
| PATCH | `/:userId/role` | Kurumsal + Owner | Rol değiştir |
| PATCH | `/:userId/profile` | Kurumsal | Profil güncelle |
| DELETE | `/:userId` | Kurumsal + Owner | Üyeyi kaldır |

**POST body:** `{ email, roleId, firstName?, lastName?, phone? }`

### Roller — `/auth/seller/roles`

| Method | Path | Auth | Ne yapar |
|--------|------|------|----------|
| GET | `/permissions` | Kurumsal + `roles.read` | Seller izin listesi |
| GET | `/assignable` | Kurumsal + Owner | Atanabilir roller |
| GET | `/` | Kurumsal + `roles.read` | Rol listesi |
| GET | `/:roleId` | Kurumsal + `roles.read` | Rol detayı |
| POST | `/` | Kurumsal + Owner | Rol oluştur |
| PATCH | `/:roleId` | Kurumsal + Owner | Rol güncelle |
| DELETE | `/:roleId` | Kurumsal + Owner | Rol sil |

### Ürünler — `/auth/seller/products`

| Method | Path | Auth | Ne yapar |
|--------|------|------|----------|
| GET | `/mine` | Seller + `products.read` | Kendi ürünlerini listele |
| POST | `/` | Seller + `products.write` | Ürün oluştur (multipart + görseller) |
| PATCH | `/:productId` | Seller + `products.write` | Ürün güncelle |
| POST | `/:productId/images` | Seller + `products.write` | Görsel ekle (multipart) |
| DELETE | `/:productId/images` | Seller + `products.write` | Görsel sil (`{ url }`) |
| DELETE | `/:productId` | Seller + `products.write` | Ürün sil |

**POST body (multipart):**
```
categoryId, name, slug?, description?, price, stock?, minOrderQuantity?, isActive?
+ opsiyonel görsel dosyaları
```

### Cüzdan — `/auth/seller/wallet`

| Method | Path | Auth | Ne yapar |
|--------|------|------|----------|
| GET | `/` | Kurumsal + `orders.read` | Bakiye (pending/available) |

### Destek — `/auth/seller/support`

Buyer destek ile aynı yapı; seller şirketine scope'lanmış.

| Method | Path | Auth | Ne yapar |
|--------|------|------|----------|
| GET | `/` | Seller + `orders.read` | Ticket listesi |
| POST | `/` | Seller + `orders.read` | Ticket oluştur |
| GET | `/:ticketId` | Seller + `orders.read` | Ticket detayı |
| GET | `/:ticketId/messages` | Seller + `orders.read` | Mesaj listesi |
| POST | `/:ticketId/messages` | Seller + `orders.read` | Cevap yaz |

---

## İzin Anahtarları (UI Gating)

Frontend'de menü/buton gösterimi için login response'taki `permissions` dizisini kullan.

### Admin izinleri

```
admins.read, admins.write, admins.delete
adminRoles.read, adminRoles.write, adminRoles.delete
sellers.read, sellers.approve
categories.read, categories.write
orders.read
support.read, support.write
returns.read, returns.write
buyers.read
finance.read, finance.export
```

### Seller izinleri

```
products.read, products.write
orders.read, orders.write
company.read, company.write
members.read, members.write, members.delete
roles.read, roles.write, roles.delete
```

---

## Tipik Frontend Akışları

### 1. Buyer kayıt & alışveriş

```
POST /auth/register
  → POST /auth/verify-email
  → PATCH /auth/profile (profil tamamla → isActive=true)
  → GET /products (ürünleri gez)
  → POST /cart/items (sepete ekle)
  → POST /orders (sipariş oluştur)
  → POST /payments (Iyzico'ya yönlendir)
  → [Iyzico callback — backend otomatik]
  → GET /payments/order/:orderId (polling ile durum kontrol)
  → GET /orders/:orderId (sipariş detayı)
```

### 2. Seller kayıt & satış

```
POST /auth/register (role: seller)
  → POST /auth/verify-email
  → PATCH /auth/profile (şirket bilgileri)
  → POST /auth/profile/documents (KYC belgeleri)
  → [Admin onayı bekle — approvalStatus: approved]
  → POST /auth/seller/products (ürün ekle)
  → GET /orders/seller (gelen siparişler)
  → POST /orders/:orderId/shipments (kargo bilgisi)
  → PATCH /orders/:orderId/status (shipped → delivered)
```

### 3. İade akışı

```
POST /orders/:orderId/returns (buyer talep açar)
  → GET /orders/returns (buyer durumu takip eder)
  → GET /auth/admin/returns (admin listeler)
  → PATCH /auth/admin/returns/:requestId (admin onaylar/reddeder)
```

### 4. Destek akışı

```
POST /support (buyer ticket açar)
  → GET /support/:ticketId/messages (mesajları oku)
  → POST /support/:ticketId/messages (buyer cevaplar)
  → POST /auth/admin/support/:ticketId/messages (admin cevaplar)
  → PATCH /auth/admin/support/:ticketId (admin durum/assignee günceller)
```

---

## Frontend İstek Örneği

```typescript
const API_BASE = import.meta.env.VITE_API_URL;

async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('token');

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message);
  }

  return res.json();
}

// Kullanım
const { products, pagination } = await api('/products?categoryId=...&page=1');
const { cart } = await api('/cart');
await api('/cart/items', {
  method: 'POST',
  body: JSON.stringify({ productId: '...', quantity: 2 }),
});
```

### Dosya yükleme örneği

```typescript
const formData = new FormData();
formData.append('docType', 'taxCertificate');
formData.append('file', file);

await fetch(`${API_BASE}/auth/profile/documents`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: formData,
});
```

---

## Özet — Endpoint Sayıları

| Alan | Adet |
|------|------|
| Health | 2 |
| Katalog | 5 |
| Auth | 19 |
| Sepet | 5 |
| Siparişler (buyer + seller) | 11 |
| Ödemeler | 3 |
| Destek (buyer) | 5 |
| Admin | 46 |
| Seller | 25 |
| **Toplam** | **~119** |

---

## Notlar

- UUID formatındaki tüm ID'ler geçerli UUID olmalıdır; aksi halde `400` döner.
- Rate limit uygulanan public endpoint'ler: kayıt, giriş, kategori listesi, ödeme callback.
- Ödeme callback'i (`POST /payments/callback`) yalnızca Iyzico tarafından çağrılır; frontend bu endpoint'e istek atmamalıdır.
- Login sonrası dönen `permissions` dizisini route guard ve menü görünürlüğü için kullanın.
- Seller `approvalStatus`: `draft` → `pending` → `approved` | `rejected`. Onaylanmadan ürün/sipariş endpoint'leri `403` döner.
