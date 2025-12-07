-- CreateTable
CREATE TABLE "FacilityNotificationLog" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FacilityNotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FacilityNotificationLog_facilityId_kind_createdAt_idx" ON "FacilityNotificationLog"("facilityId", "kind", "createdAt");

-- AddForeignKey
ALTER TABLE "FacilityNotificationLog" ADD CONSTRAINT "FacilityNotificationLog_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;
