-- Additive Migration: Packaged Food Details & Secondary Barcode Indexing
-- Migration: 20261110160000_barcode_packaged_food

-- AlterTable: Add packaged product fields to food_items
ALTER TABLE "food_items"
  ADD COLUMN IF NOT EXISTS "image_url" VARCHAR(500),
  ADD COLUMN IF NOT EXISTS "manufacturer" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "ingredients_text" TEXT,
  ADD COLUMN IF NOT EXISTS "allergens" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "countries" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "net_weight_grams" DECIMAL(8, 2);

-- CreateTable: food_barcodes for multi-barcode linking to products
CREATE TABLE IF NOT EXISTS "food_barcodes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "food_item_id" UUID NOT NULL,
    "barcode" VARCHAR(64) NOT NULL,
    "format" VARCHAR(32),
    "country" VARCHAR(10),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "food_barcodes_pkey" PRIMARY KEY ("id")
);

-- Indexes & Unique Constraints
CREATE UNIQUE INDEX IF NOT EXISTS "food_barcodes_barcode_key" ON "food_barcodes"("barcode");
CREATE INDEX IF NOT EXISTS "food_barcodes_barcode_idx" ON "food_barcodes"("barcode");
CREATE INDEX IF NOT EXISTS "food_barcodes_food_item_id_idx" ON "food_barcodes"("food_item_id");

-- ForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'food_barcodes_food_item_id_fkey'
  ) THEN
    ALTER TABLE "food_barcodes"
      ADD CONSTRAINT "food_barcodes_food_item_id_fkey"
      FOREIGN KEY ("food_item_id")
      REFERENCES "food_items"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END $$;

-- Backfill existing food_items barcodes into food_barcodes
INSERT INTO "food_barcodes" ("food_item_id", "barcode", "created_at")
SELECT "id", "barcode", CURRENT_TIMESTAMP
FROM "food_items"
WHERE "barcode" IS NOT NULL
ON CONFLICT ("barcode") DO NOTHING;
