# MVP Known Limitations

Bu liste MVP sunumu ve pilot dönem için bilinçli teknik sınırları tanımlar.

## Tasarım kararları (bug değil)

| Konu | Davranış |
|------|----------|
| Shipment ≠ fulfillment | Kargo kaydı (`POST /orders/:id/shipments`) sipariş kalemi durumunu otomatik güncellemez. Satıcı ayrıca `PATCH .../items/:productId/status` çağırmalıdır. |
| İade yetkisi | Admin iade yönetimi `returns.read` / `returns.write` ile ayrılmıştır (destek yetkisinden bağımsız). |

## Finans / iade

| Konu | Durum |
|------|--------|
| Buyer Iyzico refund | Tam ve kısmi iade |
| Payment split reversal | İade onayında oransal `reversed` + `reversedSellerShare` |
| Satıcı cüzdanı | `return_reversal` ledger + pending/available clawback |
| Multi-seller sipariş | Kalem bazlı oransal; satıcı bazlı Iyzico item refund ileride |

## Test

| Alan | Durum |
|------|--------|
| Unit + integration | `npm test` — route ve domain kapsamı |
| E2E | `E2E_MONGO_URI` veya `MONGO_URI` gerekir; CI’da koşar |

## Bilinçli ertelenen altyapı

Redis, WebSocket, Kubernetes, ayrı microservice deploy — MVP sonrası trafik/ekip sinyaline göre. Bkz. `ARCHITECTURE.md` → Scale roadmap.
