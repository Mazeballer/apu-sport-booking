-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "reminderEmailSentAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Booking_start_status_reminderEmailSentAt_idx" ON "Booking"("start", "status", "reminderEmailSentAt");
