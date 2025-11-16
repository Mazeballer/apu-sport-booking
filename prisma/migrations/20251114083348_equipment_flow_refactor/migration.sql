/*
  Warnings:

  - The values [issued,returned] on the enum `EquipReqStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- CreateEnum
CREATE TYPE "EquipReturnCondition" AS ENUM ('good', 'damaged', 'lost', 'not_returned');

-- AlterEnum
BEGIN;
CREATE TYPE "EquipReqStatus_new" AS ENUM ('pending', 'approved', 'denied', 'done');
ALTER TABLE "public"."EquipmentRequest" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "EquipmentRequest" ALTER COLUMN "status" TYPE "EquipReqStatus_new" USING ("status"::text::"EquipReqStatus_new");
ALTER TYPE "EquipReqStatus" RENAME TO "EquipReqStatus_old";
ALTER TYPE "EquipReqStatus_new" RENAME TO "EquipReqStatus";
DROP TYPE "public"."EquipReqStatus_old";
ALTER TABLE "EquipmentRequest" ALTER COLUMN "status" SET DEFAULT 'pending';
COMMIT;

-- AlterTable
ALTER TABLE "EquipmentRequest" ADD COLUMN     "returnedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "EquipmentRequestItem" ADD COLUMN     "condition" "EquipReturnCondition",
ADD COLUMN     "damageNotes" TEXT,
ADD COLUMN     "dismissed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "issuedAt" TIMESTAMP(3),
ADD COLUMN     "qtyReturned" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "EquipmentRequestItem_equipmentId_idx" ON "EquipmentRequestItem"("equipmentId");
