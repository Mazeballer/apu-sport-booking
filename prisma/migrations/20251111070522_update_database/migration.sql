/*
  Warnings:

  - You are about to drop the column `sportId` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `conflictGroupId` on the `Court` table. All the data in the column will be lost.
  - You are about to drop the `CourtSport` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `FacilitySchedule` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Sport` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[authId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "public"."Booking" DROP CONSTRAINT "Booking_sportId_fkey";

-- DropForeignKey
ALTER TABLE "public"."CourtSport" DROP CONSTRAINT "CourtSport_courtId_fkey";

-- DropForeignKey
ALTER TABLE "public"."CourtSport" DROP CONSTRAINT "CourtSport_sportId_fkey";

-- DropForeignKey
ALTER TABLE "public"."FacilitySchedule" DROP CONSTRAINT "FacilitySchedule_facilityId_fkey";

-- DropIndex
DROP INDEX "public"."Court_active_idx";

-- DropIndex
DROP INDEX "public"."Court_conflictGroupId_idx";

-- AlterTable
ALTER TABLE "Booking" DROP COLUMN "sportId",
ADD COLUMN     "sportName" TEXT;

-- AlterTable
ALTER TABLE "Court" DROP COLUMN "conflictGroupId";

-- AlterTable
ALTER TABLE "Facility" ADD COLUMN     "capacity" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "closeTime" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "isMultiSport" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "locationType" TEXT NOT NULL DEFAULT 'Indoor',
ADD COLUMN     "numberOfCourts" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "openTime" TEXT,
ADD COLUMN     "sharedSports" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "authId" TEXT,
ADD COLUMN     "name" TEXT NOT NULL DEFAULT '';

-- DropTable
DROP TABLE "public"."CourtSport";

-- DropTable
DROP TABLE "public"."FacilitySchedule";

-- DropTable
DROP TABLE "public"."Sport";

-- CreateIndex
CREATE UNIQUE INDEX "User_authId_key" ON "User"("authId");
