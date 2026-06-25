# MVP Demo Script

Sandbox Iyzico + test SMTP önerilir. Canlı iade onayı (refund) finans etkisi gösterir — demo’da opsiyonel.

## 1. Buyer kayıt ve profil (~3 dk)

1. `POST /auth/register` — buyer
2. E-posta verify (`POST /auth/verify-email`)
3. `POST /auth/login`
4. `PATCH /auth/profile` — profil tamamla
5. `GET /auth/profile/addresses` — adres listesi
6. `POST /auth/profile/addresses` — teslimat adresi ekle

## 2. Alışveriş ve ödeme (~5 dk)

1. Public katalogdan ürün seç
2. `POST /cart/items`
3. `POST /orders` — `addressId` ile sipariş
4. `POST /payments` — checkout token
5. Iyzico callback / sandbox ödeme → sipariş `paid`

## 3. Satıcı fulfillment (~3 dk)

1. Seller login
2. `GET /orders/seller`
3. `POST /orders/:orderId/shipments` — kargo bilgisi
4. `PATCH /orders/:orderId/items/:productId/status` — `shipped` → `delivered`

## 4. Admin (~2 dk)

1. Admin login
2. `GET /auth/admin/sellers?status=pending` — onay bekleyen (veya önceden onaylı seed)
3. `GET /auth/admin/categories` — kategori yönetimi (kısa)

## 5. Opsiyonel — destek / iade

- **Destek:** `POST /support` — ticket aç
- **İade talebi:** `POST /orders/:orderId/returns` — sadece talep oluşturma göster
- **İade onayı:** Admin `PATCH /auth/admin/returns/:requestId` — sandbox refund; demo’da atlanabilir

## Sunumda söylenecekler

- Kargo kaydı ve fulfillment iki adım (kasıtlı).
- İade: buyer refund + split/cüzdan düzeltmesi backend’de mevcut; tam finans raporu v1.1’de güçlendirilir.
