import { prisma } from "@/lib/prisma";
import { Facility } from "@prisma/client";
import { generateFacilityMessage } from "@/lib/ai/facilityMessage";
import { sendPushToUser } from "@/lib/push";

export type FacilityChangeKind = "closed" | "reopened" | "hours_changed";

// We only really need a small snapshot
type FacilitySnapshot = Pick<
  Facility,
  "id" | "name" | "openTime" | "closeTime" | "active"
>;

type NotifyArgs = {
  kind: FacilityChangeKind;
  facility: FacilitySnapshot;
  before?: FacilitySnapshot;
  after?: FacilitySnapshot;
};

export async function notifyFacilityChange({ kind, facility }: NotifyArgs) {
  // Just queue the change, cron will send later
  await prisma.facilityNotificationLog.create({
    data: {
      facilityId: facility.id,
      kind,
    },
  });

  console.log(
    `[facilityNotify] Queued change (${kind}) for facility ${facility.name}`
  );
}
