# Architecture Rules

This backend follows a **layered feature architecture**. Each layer has a single responsibility.

## Request flow

```
HTTP → features/ (routes + thin services)
     → domain/ (business rules)
     → repositories/ (database access)
     → infrastructure/ (MongoDB, Iyzico, Resend, Supabase)
```

## Layer responsibilities

| Layer | Responsibility | Must NOT |
|-------|----------------|----------|
| `features/` | HTTP entry: routes, Zod schemas, status codes, thin orchestration | Business rules, direct DB queries |
| `domain/` | All business logic, use-cases, permissions, events | Import Fastify, HTTP types |
| `repositories/` | Mongoose CRUD and queries | Business validation, throw CommerceError for rules |
| `infrastructure/` | External adapters (DB models, payment, mail, storage) | Business rules |
| `shared/` | Cross-cutting utilities: errors, logging, IDs, generic validation | Domain-specific logic |
| `middleware/` | Auth guards, request validation | Business logic |
| `plugins/` | Global Fastify setup (CORS, rate limit, error handler) | Feature logic |

## Import rules

```
features/       → domain, shared, middleware (NOT repositories directly — use domain)
domain/         → repositories, infrastructure, shared
repositories/   → infrastructure (models), shared
infrastructure/ → shared (minimal)
shared/         → nothing from domain/features/repositories
```

## Feature service pattern

Feature services should be thin wrappers (~50 lines max):

```typescript
// features/buyers/cart/cart.service.ts
import { addToCart as addToCartUseCase } from '@/domain/cart/add-to-cart';

export const addToCart = (buyerId: string, input: AddToCartInput) =>
  addToCartUseCase(buyerId, input);
```

Routes handle HTTP concerns only: `preHandler`, `validateBody`, `handleRouteError`, status codes.

## Domain module layout

```
domain/
├── auth/
├── buyers/         (address book)
├── cart/
├── catalog/
├── finance/        (commission reports)
├── notification/   (outbox, email side effects)
├── orders/         (shipments, returns, fulfillment)
├── payment/
├── sellers/
└── support/
```

## Events (outbox)

Side effects (email, ops alerts) go through `domain/notification/outbox/` — never send mail directly from routes.

Event names use dot notation: `email.order.confirmation`, `support.ticket.created`.

## Tests

- Unit tests for `domain/` logic
- Integration tests for `features/` routes (HTTP inject)
- E2E for full flows
- Run `npm run check:imports` to enforce layer import boundaries
