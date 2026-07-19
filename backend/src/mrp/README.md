# Material Requirements Planning (MRP) Module

This module provides the architectural foundation and execution scaffolding for the **Material Requirements Planning (MRP)** system. 

---

## 1. Overview
The MRP module determines the requirements of raw materials and assemblies needed to fulfill finished goods demand (defined by active Sales Orders). It calculates the quantities required, identifies current inventory shortages, and schedules manufacturing (Production Orders) or purchasing (Purchase Orders) actions by offsetting lead times.

---

## 2. Architecture & Request Flow
The module is designed around a strictly layered architecture pattern to ensure clear separation of concerns.

```
                  Client Request
                        │
                        ▼
               Route (mrp.routes.js)
                        │
                        ▼
          Controller (mrp.controller.js)
                        │
                        ▼
             Service (mrp.service.js)
                        │
                        ▼
          Repository (mrp.repository.js)
                        │
                        ▼
           Database Client (Prisma ORM)
                        │
                        ▼
               PostgreSQL Database
```

### Decoupled Core Logic
All calculations and rules are housed within the `algorithms/` directory as pure functions. They have absolutely no dependencies on the database interface (Prisma) or the transport layer (Express), making them easily testable, modular, and reusable.

---

## 3. Folder Structure & Responsibilities

```
src/mrp/
├── README.md               # Developer documentation (This file)
├── index.js                # Module entry point exporting public APIs
├── constants/
│   └── mrp.constants.js    # Immutable configuration settings & statuses (Placeholder)
├── types/
│   └── mrp.types.js        # Shared JSDoc contracts for MRP domain objects
├── errors/
│   └── mrp.errors.js       # Shared MRP error types
├── routes/
│   └── mrp.routes.js       # Express routing registers
├── controllers/
│   └── mrp.controller.js   # HTTP Request/Response adapter mapping
├── services/
│   └── mrp.service.js      # Business workflow orchestration layer
├── repositories/
│   └── mrp.repository.js   # Database client interactions (Prisma)
└── algorithms/
    ├── bomExplosion.js     # Explodes finished goods demand into BOM parts (Placeholder)
    ├── shortageCalculator.js # Computes net material shortfalls (Placeholder)
    └── mrpCalculator.js    # Core orchestrator of calculation runs (Placeholder)
```

### Layer Responsibilities
* **Routes**: Maps HTTP paths to controller handlers. Does not contain logic.
* **Controllers**: Handles Express integrations, extracts input, formats JSON outputs, maps HTTP status codes, and handles uncaught controller-level exceptions.
* **Services**: The orchestrator of system transactions. Combines repository-level database queries and coordinates processing flows.
* **Repositories**: Performs read access via Prisma, maps records to plain objects, and never owns business rules.
* **Algorithms**: Decoupled utilities performing mathematical calculations.

### Repository Notes (Milestone 1)
* `select` is preferred over `include` to fetch only planning fields needed by MRP and keep payloads small.
* Nested relation reads (sales order line + product + sales order, BOM header + BOM lines) are bulk-loaded to avoid N+1 query patterns.
* Repository output is always plain JavaScript objects so service/algorithms remain independent from Prisma models.
* Business rules and planning decisions belong to the service layer, not the repository.

---

## 4. Current API (Phase 1)

### Get All Sales Orders
Retrieves open sales orders from the system to establish independent demand.

* **URL**: `/api/mrp/sales-orders`
* **Method**: `GET`
* **Headers**: `Content-Type: application/json`
* **Success Response (200 OK)**:
  ```json
  [
    {
      "salesOrderId": "SO-001",
      "customerId": "CUST-100",
      "orderDate": "2026-07-19T00:00:00.000Z",
      "status": "OPEN"
    }
  ]
  ```
* **Error Response (500 Internal Server Error)**:
  ```json
  {
    "error": "Internal Server Error"
  }
  ```

---

## 5. Future Scope (Phase 2 & 3)
* **BOM Explosion**: Implement the multi-level hierarchical explosion of Bill of Materials.
* **Shortage Calculation**: Incorporate time-phased calculations balancing current stocks, safety levels, and open orders.
* **Lead-Time Offsetting**: Backward-schedule start dates based on item-specific lead times.
* **Plan Persistence**: Save recommendations back to the database as Planned Purchase Orders and Planned Production Orders.
* **Transactions & Validations**: Add payload schemas and transactional safety.

---

## 6. Extension Guidelines
1. **Never leak database objects to Algorithms**: Algorithms must receive clean primitive values or objects.
2. **Never access req/res below Controllers**: Services and Repositories must remain transport-independent.
3. **Immutability of Constants**: All global constant values must be registered in `mrp.constants.js` and wrapped in `Object.freeze()`.
