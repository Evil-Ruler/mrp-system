# Prisma Migration Notes

## Supported states

The committed migration history supports:

- fresh installations;
- empty development databases; and
- fresh CI databases.

The Phase 3 migration `20260721000000_add_mrp_query_indexes` is additive. It creates indexes for existing MRP read paths and does not change tables, data, or application behavior.

## Legacy populated database upgrade

Do not apply `20260704111810_add_remaining_tables` directly to a populated database that has applied only `20260704041848_init`. That historical migration drops `items.item_id` and creates an `INTEGER NOT NULL` replacement; it cannot preserve existing `TEXT` item identifiers.

Migration history must remain unchanged once deployed. Before upgrading that legacy database, create and review a one-time operational migration plan that preserves and reconciles item identifiers and dependent data. Take a verified backup before executing that plan. After the database is aligned with the current schema, apply later migrations normally with `npx prisma migrate deploy`.
