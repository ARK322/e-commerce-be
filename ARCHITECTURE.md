# Architecture

E-commerce backend organized in explicit layers. Each layer has a single responsibility and a strict dependency direction.

## Request flow

```
HTTP → plugins → middleware → features (route → service) → internal → repositories → integrations
```

1. **Plugins** register Fastify infrastructure (CORS, multipart, global rate limit, error handler).
2. **Middleware** runs as route `preHandler` hooks (auth guards, permission checks, request validation).
3. **Routes** wire HTTP to services; they stay thin (no business logic, no direct DB orchestration).
4. **Services** implement use cases and coordinate `internal` helpers plus `integrations`.
5. **Internal** holds shared domain logic reusable across features.
6. **Repositories** isolate Mongoose/data access queries shared across services.
7. **Integrations** talk to external systems (MongoDB, Resend, Iyzico, Supabase).

## Directory layout

```
src/
  app/              # bootstrap, route registration (incl. register-auth-routes)
  config/           # env and app config
  features/         # HTTP surface per domain (routes + services + schemas)
  middleware/       # guards and validation preHandlers
  plugins/          # Fastify plugin registration
  repositories/     # data-access queries (Mongoose), shared across services
  internal/         # shared domain logic
    common/         # cross-cutting helpers (no domain coupling)
    auth/           # auth, tokens, permissions, profile helpers
    catalog/        # catalog domain helpers
    buyers/         # buyer/payment domain helpers
  integrations/     # third-party adapters
    mongo/          # Mongoose models + connection (barrel export)
    resend/
    iyzico/
    supabase/
```

## Layer rules

### `features/`

Only these file types:

| Suffix | Role |
|--------|------|
| `*.routes.ts` | HTTP handlers; call services, map errors via `handleRouteError` |
| `*.service.ts` | Use-case logic for one feature area |
| `*.schema.ts` | Zod schemas for that feature's request/response shapes |

Domain grouping: `identity/`, `buyers/`, `sellers/`, `catalog/`, `admin/`.

Routes may import middleware, plugins (e.g. scoped rate limit), `internal`, and their own service/schemas. They must not contain parsing, permission, or persistence logic beyond wiring. **Routes call feature services only** — never `@/internal/*` helpers or `@/integrations/mongo` directly (multipart file read + pass to service is OK).

### `middleware/`

- Auth guards: `requireAuth`, `requireAdmin`, `requireEmailVerified`, seller/buyer guards.
- Validation preHandlers: `validateBody`, `validateQuery`, `validateParams`, `validateBodyByRole`.
- Presets: reusable `preHandler` arrays and rate-limit constants (`presets/`).

Middleware may import `internal` and feature **schemas** when validation is role- or endpoint-specific (e.g. `validate-body-by-role`). It must not import services.

### `plugins/`

Fastify cross-cutting setup that is not per-route:

- Global: CORS, form body, error handler, global rate limit.
- Scoped: multipart parsers, per-prefix rate limits (`register-scoped`).

Plugins register on the app; they do not implement business rules.

### `internal/`

Shared logic used by multiple features. Split into:

**`internal/common/`** — generic, domain-agnostic utilities:

| Folder | Purpose |
|--------|---------|
| `errors/` | `HttpError`, `CommerceError`, `handleRouteError`, duplicate-key helpers |
| `validation/` | Reusable Zod primitives, param schemas, sanitization |
| `security/` | Password hashing |
| `ids/` | ID generation |
| `logging/` | Logger and Fastify bridge |
| `cache/` | In-memory cache and catalog cache keys |

**Domain folders** at `internal/` root — `auth/`, `catalog/`, `buyers/`, etc. These encode business rules (permissions, product images, payment splits, profile updates).

### `integrations/`

Adapters for external systems. No imports from `features/` or `middleware/`.

**MongoDB:** import models only from the barrel:

```ts
import { Product, SellerMember } from '@/integrations/mongo';
```

Do not deep-import `@/integrations/mongo/models/...` outside the barrel (`integrations/mongo/index.ts`).

## Dependency direction

```
features → middleware (preHandler wiring only)
features → internal → repositories → integrations
integrations ↛ features | internal (domain) | middleware
internal (domain) ↛ features
features ↛ features (use internal or repositories instead)
```

Allowed exceptions:

- `middleware → features/*.schema.ts` for endpoint-specific validation.
- `internal/common/*` must not import `internal/auth`, `internal/catalog`, etc.

## Schemas

| Location | Use |
|----------|-----|
| `features/**/**.schema.ts` | Request/response shapes for a specific endpoint or feature |
| `internal/**/schemas/` | Small reusable primitives (email, password, OTP) shared across auth flows |
| `internal/**/**.schema.ts` | Domain input schemas shared by multiple HTTP surfaces (e.g. category admin CRUD) |
| `internal/common/validation/` | Generic validators (`uuidSchema`, `slugSchema`, param schemas) |

Endpoint schemas compose internal primitives; they do not live in `middleware/`.

## Errors

- Throw `CommerceError` or `AuthError` (extends `HttpError`) from services/internal.
- Routes catch and delegate to `handleRouteError(reply, error, fallbackMessage)`.
- The global error-handler plugin maps unhandled errors to HTTP responses.

## Caching

Public catalog reads use **in-process memory cache** (`internal/common/cache`). There is **no Redis** in this project.

| Layer | What | Default TTL |
|-------|------|-------------|
| `memoryCache` | Category tree, product list/detail | 3–5 min |
| `visible-category-ids` key | Active category ID set for product filters | 60 s |
| HTTP `Cache-Control` | Browser/CDN cache on public GET routes | 30–60 s |

**Invalidation**

- Category admin writes → `invalidateCatalogCache()` (categories + products + visible IDs).
- Product seller writes → `invalidateCatalogProductCache()` (all product keys).
- Stock decrement on payment → `invalidateCatalogProductDetail()` per product only (list caches expire via TTL).

**Deployment constraint:** memory cache is **per process**. Run **one backend instance** unless you disable cache (`CATALOG_CACHE_ENABLED=false`) or accept short TTL staleness across instances. For multi-instance scale later, introduce a `CacheProvider` abstraction and plug in Redis without changing feature services.

**Env toggles**

- `CATALOG_CACHE_ENABLED` — `true` (default) / `false`
- `CATALOG_CATEGORIES_CACHE_TTL_MS`, `CATALOG_PRODUCTS_LIST_CACHE_TTL_MS`, `CATALOG_PRODUCT_DETAIL_CACHE_TTL_MS`, `CATALOG_VISIBLE_CATEGORIES_CACHE_TTL_MS`

## Testing

- Unit tests mirror `src/` under `tests/unit/`.
- Integration tests under `tests/integration-test/`.
- Mock `@/integrations/mongo` (barrel), not individual model paths.

## Adding a new endpoint (checklist)

1. Add or extend `*.schema.ts` in the relevant `features/` folder.
2. Implement logic in `*.service.ts` (or extend an existing service).
3. Add a thin handler in `*.routes.ts` with the right middleware preset.
4. Put reusable non-HTTP logic in `internal/` (domain) or `internal/common/` (generic).
5. Access MongoDB only via `@/integrations/mongo`.
