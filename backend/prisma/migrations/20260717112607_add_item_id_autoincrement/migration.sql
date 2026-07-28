-- AlterTable
CREATE SEQUENCE items_item_id_seq;
ALTER TABLE "items" ALTER COLUMN "item_id" SET DEFAULT nextval('items_item_id_seq');
ALTER SEQUENCE items_item_id_seq OWNED BY "items"."item_id";
