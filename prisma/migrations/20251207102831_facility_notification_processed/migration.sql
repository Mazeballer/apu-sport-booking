-- AlterTable
ALTER TABLE "FacilityNotificationLog" ADD COLUMN     "processed" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "FacilityNotificationLog_processed_createdAt_idx" ON "FacilityNotificationLog"("processed", "createdAt");
