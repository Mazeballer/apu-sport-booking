/*
  Warnings:

  - You are about to drop the column `sportName` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `Equipment` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."Booking_courtId_start_end_key";

-- AlterTable
ALTER TABLE "Booking" DROP COLUMN "sportName";

-- AlterTable
ALTER TABLE "Equipment" DROP COLUMN "notes";
