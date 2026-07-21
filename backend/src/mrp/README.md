# Material Requirements Planning (MRP) Module

Enterprise-grade Material Requirements Planning engine built with Node.js, Express, and a strictly layered Clean Architecture.

---

## 1. Overview

The MRP module determines the material and component requirements needed to fulfill customer sales order demand. It executes a deterministic 6-stage planning pipeline that:

1. Loads demand, BOM structures, item masters, inventory, and open supply orders from the database
2. Validates all input data against domain invariants
3. Explodes finished-good demand through multi-level Bills of Material (BOM) hierarchies
4. Nets gross component requirements against available warehouse inventory
5. Allocates remaining shortages against committed open Purchase and Production Orders
6. Generates actionable PURCHASE or PRODUCTION recommendations for unfulfilled shortages

The engine preserves **full end-to-end demand lineage** — every recommendation traces back to the originating sales order, line item, BOM level, and traversal path.

---

## 2. Architecture & Request Flow

The module implements a strictly layered architecture where each layer depends only on the layer directly below it. Business logic never leaks into transport or persistence layers.

```
                  Client Request (HTTP)
                         │
                         ▼
                ┌─────────────────┐
                │  Route Layer    │  mrp.routes.js
                │  (Express)      │  URL → Controller mapping
                └────────┬────────┘
                         │
                         ▼
                ┌─────────────────┐
                │  HTTP Validation│  mrp.validation.js
                │                 │  Query param parsing & normalization
                └────────┬────────┘
                         │
                         ▼
                ┌─────────────────┐
                │  Controller     │  mrp.controller.js
                │                 │  req/res adapter, error mapping
                └────────┬────────┘
                         │
                         ▼
                ┌─────────────────┐
                │  Service Layer  │  mrp.service.js
                │  (Orchestrator) │  Pipeline sequencing & summary
                └────────┬────────┘
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
   ┌────────────┐ ┌────────────┐ ┌────────────┐
   │ Planning   │ │ Engine     │ │ Repository │
   │ Validation │ │ Pipeline   │ │ Layer      │
   │            │ │            │ │            │
   │ planning.  │ │ Stage 1-4  │ │ mrp.       │
   │ validation │ │ (Pure Fn)  │ │ repository │
   └────────────┘ └────────────┘ └─────┬──────┘
                                       │
                                       ▼
                              ┌─────────────────┐
                              │  Prisma ORM     │
                              │                 │
                              │  PostgreSQL     │
                              └─────────────────┘
```

### Layer Responsibilities

| Layer | File | Responsibility |
|---|---|---|
| **Routes** | `routes/mrp.routes.js` | Maps HTTP verbs + paths to controller methods. Contains zero logic. |
| **HTTP Validation** | `validation/mrp.validation.js` | Validates and normalizes HTTP query parameters (`salesOrderIds`, ISO-8601 dates, date range invariants). |
| **Controller** | `controllers/mrp.controller.js` | Thin HTTP adapter. Reads query params, invokes service, formats JSON responses, maps domain errors to HTTP status codes. |
| **Service** | `services/mrp.service.js` | Orchestrates the 6-stage planning pipeline. Loads data from repository, invokes validation and engine stages in sequence, builds planning summary. |
| **Planning Validation** | `validation/planning.validation.js` | Domain-level invariant validation (item master integrity, demand completeness, BOM structural correctness, deterministic demand sorting). |
| **Engine** | `engine/*.js` | Four pure-function pipeline stages: BOM Explosion, Inventory Netting, Supply Allocation, Recommendation Generation. |
| **Repository** | `repositories/mrp.repository.js` | Prisma ORM data access. Maps database entities to domain objects via pure mapper functions. Never owns business rules. |
| **Types** | `types/mrp.types.js` | Centralized JSDoc domain type contracts consumed by all pipeline stages. |
| **Errors** | `errors/mrp.errors.js` | Domain error classes (`ValidationError`, `DataAccessError`). |
| **Constants** | `constants/planning.constants.js` | Immutable planning configuration (`ALLOWED_DEMAND_STATUSES`). |

### Key Architectural Invariants

- **Engine functions are pure**: They receive data, return results, and never access the database, HTTP layer, or external state.
- **Repository produces plain objects**: Prisma models are mapped to domain objects via dedicated mapper functions. Downstream layers never depend on Prisma.
- **Controllers never contain business logic**: They delegate entirely to the service layer and map errors to HTTP responses.
- **Immutability**: All engine stages allocate fresh output arrays and objects. Input data is never mutated.

---

## 3. Folder Structure

```
src/mrp/
├── README.md                                   # This file
├── index.js                                    # Module entry point (public exports)
│
├── constants/
│   ├── mrp.constants.js                        # Reserved for future configuration
│   └── planning.constants.js                   # ALLOWED_DEMAND_STATUSES (APPROVED, CONFIRMED, RELEASED)
│
├── types/
│   └── mrp.types.js                            # JSDoc domain type definitions
│
├── errors/
│   └── mrp.errors.js                           # ValidationError, DataAccessError
│
├── routes/
│   ├── index.js                                # Route aggregation entry point
│   └── mrp.routes.js                           # Express route definitions
│
├── controllers/
│   └── mrp.controller.js                       # HTTP request/response adapter
│
├── validation/
│   ├── mrp.validation.js                       # HTTP query parameter validation
│   ├── mrp.validation.test.js                  # HTTP validation tests
│   ├── planning.validation.js                  # Domain invariant validation
│   └── planning.validation.test.js             # Planning validation tests
│
├── services/
│   ├── mrp.service.js                          # Pipeline orchestration service
│   └── mrp.service.test.js                     # Service orchestration tests
│
├── repositories/
│   ├── mrp.repository.js                       # Prisma data access layer
│   └── mrp.repository.test.js                  # Repository tests
│
├── engine/
│   ├── bomExplosion.js                         # Stage 1: Multi-level BOM explosion
│   ├── bomExplosion.test.js                    # BOM explosion tests
│   ├── inventoryNetting.js                     # Stage 2: Inventory stock netting
│   ├── inventoryNetting.test.js                # Inventory netting tests
│   ├── supplyAllocation.js                     # Stage 3: Open supply allocation
│   ├── supplyAllocation.test.js                # Supply allocation tests
│   ├── recommendationGenerator.js              # Stage 4: Recommendation generation
│   └── recommendationGenerator.test.js         # Recommendation generator tests
│
├── tests/
│   ├── mrp.api.test.js                         # HTTP endpoint integration tests
│   └── mrp.integration.test.js                 # System integration tests
│
├── mrp.e2e.test.js                             # End-to-end pipeline tests
│
└── algorithms/                                 # Deprecated no-op stubs, superseded by engine/.
    ├── bomExplosion.js                          #   No longer referenced anywhere (removed from
    ├── mrpCalculator.js                         #   index.js); slated for deletion via `git rm`.
    └── shortageCalculator.js
```

---

## 4. Planning Pipeline (6 Stages)

### Pipeline Execution Flow

```
runPlanning(filters)
    │
    ├── Stage 0: Data Loading
    │   ├── getDemandOrderLines(filters)    → Demand[]
    │   ├── getItems()                      → Item[]
    │   ├── getBomData()                    → { headers: BomHeader[], lines: BomLine[] }
    │   ├── getInventory()                  → InventoryRecord[]
    │   ├── getOpenPurchaseOrders()          → SupplyRecord[]
    │   └── getOpenProductionOrders()        → SupplyRecord[]
    │
    ├── Stage 0.5: Domain Validation
    │   ├── validateItems(items)
    │   ├── validateDemand(demand)           (validates Number.isFinite on quantities)
    │   ├── validateBom(bom, demand, items)  (BOM ambiguity, demanded finished goods empty BOMs, orphan lines, Number.isFinite on qtyPerParent)
    │   └── sortDemand(demand)              → Demand[] (sorted)
    │
    ├── Stage 1: BOM Explosion
    │   └── explodeBom({ demand, bom, items })  → ExplodedRequirement[]
    │
    ├── Stage 2: Inventory Snapshot & Netting
    │   ├── createInventorySnapshot(inventory)              → InventoryRecord[]
    │   └── calculateInventoryNetting(exploded, snapshot)   → NetRequirement[]
    │
    ├── Stage 3: Supply Allocation
    │   └── allocateSupply(netReqs, purchaseOrders, productionOrders)  → AllocatedRequirement[]
    │
    ├── Stage 4: Recommendation Generation
    │   └── generateRecommendations(allocatedReqs, items)  → Recommendation[]
    │
    └── Stage 5: Summary & Output
        └── _buildPlanningSummary(...)  → PlanningSummary
```

### Stage Details

#### Stage 1 — BOM Explosion (`bomExplosion.js`)

Recursively traverses Bill of Materials hierarchies to convert finished-good demand into component-level gross requirements.

- **Input**: Sorted demand lines, BOM headers/lines, item master
- **Output**: `ExplodedRequirement[]` — one record per component per demand line per BOM level
- **Key behaviors**:
  - Multi-level recursive traversal with depth tracking (`bomLevel`)
  - O(1) cycle detection via `visitedSet` per demand traversal
  - Quantity cascading: `parentQty × qtyPerParent` at each level
  - Ancestor path tracking (`path[]`) for traceability
  - Root finished goods are never emitted in output
  - Output is deterministically sorted by: `requiredDate` → `bomLevel` → `itemId` → `salesOrderId` → `salesOrderLineId`

#### Stage 2 — Inventory Netting (`inventoryNetting.js`)

Offsets gross component requirements against available warehouse stock balances.

- **Input**: `ExplodedRequirement[]`, warehouse inventory records
- **Output**: `NetRequirement[]` — one record per exploded requirement with stock allocation details
- **Key behaviors**:
  - Multi-location inventory aggregation per item
  - Negative stock clamping to zero
  - Chronological priority: earlier demand consumes stock first
  - Stateful depletion tracking via fresh `Map` per planning run
  - Full demand lineage preserved on every output record

#### Stage 3 — Supply Allocation (`supplyAllocation.js`)

Offsets net shortages against committed open Purchase Orders and Production Orders.

- **Input**: `NetRequirement[]`, open Purchase Orders, open Production Orders
- **Output**: `AllocatedRequirement[]` — one record per net requirement with supply allocation details
- **Key behaviors**:
  - **Priority order**: Purchase Orders allocated **first**, then Production Orders
  - **Date constraint**: Supply allocated ONLY when `expectedDate ≤ requiredDate` (late supply is strictly ignored)
  - Earliest-supply-first within each item's pool
  - Stateful cumulative depletion across sequential requirements
  - Closed orders (`openQuantity ≤ 0`) are filtered out

#### Stage 4 — Recommendation Generation (`recommendationGenerator.js`)

Converts remaining unfulfilled shortages into actionable PURCHASE or PRODUCTION recommendations.

- **Input**: `AllocatedRequirement[]`, item master
- **Output**: `Recommendation[]` — one per unfulfilled demand line
- **Key behaviors**:
  - Recommendations generated ONLY when `remainingShortage > 0`
  - Procurement type resolved from the item's `procurementType`, which the repository derives from the item `category` (Finished Good / Sub Assembly → PRODUCTION; Raw Material / Hardware / Consumable → PURCHASE)
  - Default fallback to `"PURCHASE"` when procurement type cannot be determined
  - Intentionally unaggregated: one recommendation per demand line for full lineage

---

## 5. Domain Type Contracts

All domain types are defined in `types/mrp.types.js` and consumed across the pipeline via JSDoc `@typedef` imports.

### Core Data Models

| Type | Source | Description |
|---|---|---|
| `Demand` | Repository | Sales order demand line with `demandId`, `salesOrderId`, `salesOrderLineId`, `itemId`, `quantity`, `requiredDate`, `uom` |
| `BomHeader` | Repository | BOM structure header linking `bomHeaderId` → `parentItemId` |
| `BomLine` | Repository | BOM component line with `parentItemId`, `childItemId`, `qtyPerParent` |
| `Item` | Repository | Item master with `itemId`, `itemCode`, `itemType`, `baseUom`, optional `procurementType` |

### Pipeline Intermediate Types

| Type | Pipeline Stage | Key Fields |
|---|---|---|
| `ExplodedRequirement` | Stage 1 (BOM Explosion) | `requiredQuantity`, `bomLevel`, `path[]` + demand lineage |
| `NetRequirement` | Stage 2 (Inventory Netting) | `grossRequirement`, `availableInventoryUsed`, `netRequirement` + lineage |
| `AllocatedRequirement` | Stage 3 (Supply Allocation) | `purchaseSupplyUsed`, `productionSupplyUsed`, `remainingShortage` + lineage |
| `Recommendation` | Stage 4 (Recommendation Gen.) | `recommendationType` (PURCHASE/PRODUCTION), `quantity`, `requiredDate` + lineage |

### Planning Result

| Type | Description |
|---|---|
| `PlanningResult` | Complete pipeline output: `planningDate`, `salesOrders`, `explodedRequirements`, `netRequirements`, `allocatedRequirements`, `recommendations`, `summary` |
| `PlanningSummary` | Aggregate statistics: counts + `totalShortageQuantity` |

---

## 6. REST API Reference

All endpoints are mounted under the `/api/mrp` base path.

### GET /api/mrp/run

Executes the full 6-stage MRP planning pipeline and returns structured results.

**Query Parameters** (all optional):

| Parameter | Type | Description |
|---|---|---|
| `salesOrderIds` | `string` | Comma-separated list of sales order IDs to filter demand |
| `requiredDateFrom` | `string` | ISO-8601 date (inclusive lower bound) |
| `requiredDateTo` | `string` | ISO-8601 date (inclusive upper bound) |

**Validation Rules**:
- `salesOrderIds` accepts a comma-separated string or repeated query array; deduplicated, trimmed
- Dates must conform to strict ISO-8601 (`YYYY-MM-DD` or `YYYY-MM-DDTHH:mm:ss.sssZ`) with calendar validity checks (e.g., `2026-02-30` is rejected)
- `requiredDateFrom` must be ≤ `requiredDateTo` when both are provided

**Success Response** `200 OK`:

```json
{
  "success": true,
  "data": {
    "planningDate": "2026-07-20T00:00:00.000Z",
    "salesOrders": [ ... ],
    "explodedRequirements": [ ... ],
    "netRequirements": [ ... ],
    "allocatedRequirements": [ ... ],
    "recommendations": [
      {
        "recommendationType": "PURCHASE",
        "itemId": 3,
        "quantity": 50,
        "requiredDate": "2026-07-25T00:00:00.000Z",
        "demandSourceType": "SALES_ORDER",
        "salesOrderId": "SO-001",
        "salesOrderLineId": 1,
        "bomLevel": 1,
        "path": [1, 3]
      }
    ],
    "summary": {
      "salesOrderCount": 2,
      "explodedRequirementCount": 4,
      "netRequirementCount": 4,
      "allocatedRequirementCount": 4,
      "recommendationCount": 3,
      "purchaseRecommendationCount": 2,
      "productionRecommendationCount": 1,
      "totalShortageQuantity": 150
    }
  }
}
```

**Error Responses**:

| Status | Code | Cause |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Invalid query parameters or domain validation failure |
| `500` | `DATA_ACCESS_ERROR` | Database/Prisma query failure |
| `500` | `INTERNAL_SERVER_ERROR` | Unexpected server error (message sanitized, details logged server-side) |

**Error Response Format**:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "requiredDateFrom must be a valid ISO-8601 date string."
  }
}
```

---

### GET /api/mrp/planning-data

Loads and validates the raw planning dataset (demand, BOM structures, items) without executing the planning engine stages.

**Query Parameters**: Same as `/api/mrp/run`.

**Success Response** `200 OK`:

```json
{
  "success": true,
  "data": {
    "demand": [ ... ],
    "bom": {
      "headers": [ ... ],
      "lines": [ ... ]
    },
    "items": [ ... ]
  }
}
```

---

### GET /api/mrp/sales-orders

Returns eligible open demand sales order lines matching active planning statuses (`APPROVED`, `CONFIRMED`, `RELEASED`).

**Query Parameters**: Same as `/api/mrp/run`.

**Success Response** `200 OK`:

```json
{
  "success": true,
  "data": [
    {
      "demandId": "SO-001:1",
      "salesOrderId": "SO-001",
      "salesOrderLineId": 1,
      "itemId": 1,
      "quantity": 10,
      "requiredDate": "2026-07-25T00:00:00.000Z",
      "uom": "PCS"
    }
  ]
}
```

---

## 7. Error Handling Strategy

### Error Classification

| Error Class | HTTP Status | Purpose | Message Exposure |
|---|---|---|---|
| `ValidationError` | 400 | Invalid input (query params or domain data) | Full message exposed to client |
| `DataAccessError` | 500 | Database/Prisma failures | Full message exposed to client |
| Generic `Error` | 500 | Unexpected system failures | **Sanitized** — generic message only; raw error logged server-side via `console.error` |

### Error Propagation Path

```
Engine throws ValidationError
    → Service propagates unmodified
        → Controller._handleError() maps to HTTP 400

Repository throws DataAccessError
    → Service propagates unmodified
        → Controller._handleError() maps to HTTP 500

Unexpected Error
    → Controller._handleError() logs via console.error
        → Returns sanitized "An unexpected internal server error occurred."
```

---

## 8. Database Schema

The system uses PostgreSQL via Prisma ORM. Key entities:

| Entity | Table | Primary Key | MRP Role |
|---|---|---|---|
| `SalesOrder` | `sales_orders` | `sales_order_id` | Independent demand source |
| `SalesOrderLine` | `sales_order_lines` | `sales_order_line_id` | Demand line items (finished goods) |
| `Item` | `items` | `item_id` | Item master catalog (FG, sub-assembly, raw material) |
| `BOMHeader` | `bom_headers` | `bom_id` | BOM structure header (parent → children) |
| `BOMLine` | `bom_lines` | `bom_line_id` | BOM component lines (child item + qty per parent) |
| `PurchaseOrder` | `purchase_orders` | `purchase_order_id` | Open incoming purchase supply |
| `PurchaseOrderLine` | `purchase_order_lines` | `purchase_order_line_id` | Purchase order line items |
| `ProductionOrder` | `production_orders` | `production_order_id` | Open production (manufacturing) supply |

### Repository Domain Mapping

The repository maps database columns to domain fields via pure mapper functions:

| Database Column | Domain Field | Notes |
|---|---|---|
| `Item.category` | `Item.itemType` | Category classification mapped to domain type name |
| `Item.category` | `Item.procurementType` | Derived: Finished Good / Sub Assembly → `PRODUCTION`; otherwise → `PURCHASE` (no dedicated column in Phase 3 schema) |
| `SalesOrderLine.productId` | `Demand.itemId` | Product FK mapped to item identifier |
| `SalesOrder.orderDate` | `Demand.requiredDate` | Order date used as demand required date |
| `Item.currentStock` | `InventoryRecord.availableQuantity` | Clamped to ≥ 0 by inventory netting |
| `PurchaseOrder.orderDate` | `SupplyRecord.expectedDate` | Schema limitation: using order date as expected delivery |
| `ProductionOrder.startDate` | `SupplyRecord.expectedDate` | Schema limitation: using start date as expected completion |

---

## 9. Configuration

### Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string for Prisma |
| `PORT` | No | `3000` | HTTP server listening port |

### Planning Constants

Defined in `constants/planning.constants.js`:

```javascript
const ALLOWED_DEMAND_STATUSES = Object.freeze([
  "APPROVED",
  "CONFIRMED",
  "RELEASED",
]);
```

Only sales orders with these statuses are included in MRP planning runs.

---

## 10. Testing Strategy

The test suite uses Node.js built-in `node:test` runner with `node:assert/strict`. HTTP endpoint tests use `supertest`.

### Test Pyramid

```
                    ┌───────────────────┐
                    │   E2E Pipeline    │  mrp.e2e.test.js
                    │   18 scenarios    │
                    └─────────┬─────────┘
                  ┌───────────┴───────────┐
                  │   System Integration  │  tests/mrp.integration.test.js
                  │   + API Tests         │  tests/mrp.api.test.js
                  └───────────┬───────────┘
        ┌─────────────────────┴─────────────────────┐
        │              Unit Tests                    │
        │  Engine (4) + Service + Validation (2)     │
        │  + Repository                              │
        └────────────────────────────────────────────┘
```

### Test Categories

| Category | Location | Count | Description |
|---|---|---|---|
| **Engine Unit Tests** | `engine/*.test.js` | 4 files | Pure function tests for BOM explosion, inventory netting, supply allocation, recommendation generation |
| **Planning Validation** | `validation/planning.validation.test.js` | 1 file | Domain invariant validation (items, demand, BOM, sorting) |
| **HTTP Validation** | `validation/mrp.validation.test.js` | 1 file | Query parameter parsing, ISO-8601 dates, range invariants |
| **Service Orchestration** | `services/mrp.service.test.js` | 1 file | Pipeline sequencing, contract verification, failure propagation |
| **Repository** | `repositories/mrp.repository.test.js` | 1 file | Data access and domain mapping tests |
| **HTTP API** | `tests/mrp.api.test.js` | 1 file | Supertest HTTP endpoint integration tests |
| **System Integration** | `tests/mrp.integration.test.js` | 1 file | Cross-layer integration scenarios |
| **E2E Pipeline** | `mrp.e2e.test.js` | 1 file | Full pipeline execution with 18 production scenarios |

**Total**: 167 passing tests (Node.js built-in `node:test` runner + `node:assert/strict`; `supertest` for HTTP).
The suite fully isolates repository calls and does not require a running PostgreSQL instance.

### Running Tests

```bash
# Run all tests
npm test

# Run a specific test file
node --test src/mrp/engine/bomExplosion.test.js

# Run tests matching a name pattern
node --test --test-name-pattern="BOM" src/mrp/engine/bomExplosion.test.js
```

---

## 11. Getting Started

### Prerequisites

- Node.js ≥ 18
- PostgreSQL database
- npm

### Setup

```bash
# 1. Clone and install dependencies
cd backend
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your PostgreSQL connection string

# 3. Generate Prisma client and run migrations
npx prisma generate
npx prisma migrate deploy

# 4. Seed the database (optional)
npx prisma db seed

# 5. Start the development server
npm run dev
```

### Available Scripts

| Script | Command | Description |
|---|---|---|
| `npm start` | `node src/server.js` | Start production server |
| `npm run dev` | `nodemon src/server.js` | Start development server with hot reload |
| `npm test` | `node --test` | Run full test suite |

---

## 12. Migration Safety and Known Limitations

The checked-in Prisma migration history is safe for fresh installations, empty development databases, and fresh CI databases. The Phase 3 index migration (`20260721000000_add_mrp_query_indexes`) is additive and does not alter planning behavior.

The earlier `20260704111810_add_remaining_tables` migration changes `items.item_id` from `TEXT` to `INTEGER` by dropping and recreating the column. It must not be applied directly to a populated database that has only the initial migration: existing item identifiers cannot be preserved by that historical migration. Migration history is intentionally immutable; use an operator-reviewed, one-time upgrade plan for that legacy state. See [`prisma/MIGRATION_NOTES.md`](../../prisma/MIGRATION_NOTES.md).

The current Phase 3 time-phasing model uses the persisted order/start dates available in the schema. Dedicated demand due dates, purchase expected-delivery dates, and production completion dates are future data-model enhancements, not part of this Phase 3 implementation.

---

## 13. Extension Guidelines

1. **Never leak database objects to engine functions**: Engine stages must receive clean domain objects, never Prisma model instances.
2. **Never access `req`/`res` below the controller**: Services and repositories must remain transport-independent.
3. **Immutability of constants**: All global values must be registered in `constants/` and wrapped in `Object.freeze()`.
4. **New engine stages**: Implement as pure functions following the pattern in `engine/`. Accept typed input arrays, return newly allocated output arrays.
5. **New API endpoints**: Add route in `mrp.routes.js`, controller method in `mrp.controller.js`, service method in `mrp.service.js`. Business logic must never reside in the controller.
6. **Domain types**: Add new type definitions in `types/mrp.types.js` to maintain the centralized contract.

---

## 14. Dependencies

| Package | Version | Purpose |
|---|---|---|
| `express` | ^5.2.1 | HTTP framework |
| `@prisma/client` | ^7.8.0 | Database ORM |
| `pg` | ^8.22.0 | PostgreSQL driver |
| `cors` | ^2.8.6 | Cross-origin resource sharing |
| `dotenv` | ^17.4.2 | Environment variable loading |
| `csv-parser` | ^3.2.1 | CSV data import utilities |
| `supertest` | ^7.2.2 | HTTP integration testing (dev) |
| `nodemon` | ^3.1.14 | Development hot reload (dev) |
