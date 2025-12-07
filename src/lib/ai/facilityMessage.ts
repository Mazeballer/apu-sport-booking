import { generateAiNotification } from "./aiMessage";

export type FacilityChangeKind = "closed" | "reopened" | "hours_changed";

type FacilityMessageArgs = {
  kind: FacilityChangeKind;
  facilityName: string;
  oldOpenTime?: string | null;
  oldCloseTime?: string | null;
  newOpenTime?: string | null;
  newCloseTime?: string | null;
};

export async function generateFacilityMessage(args: FacilityMessageArgs) {
  const { kind, facilityName } = args;

  let purpose = "";
  let context = "";

  if (kind === "closed") {
    purpose =
      "Notify users that this facility is now closed for maintenance or updates";
    context = `Facility: ${facilityName}`;
  }

  if (kind === "reopened") {
    purpose =
      "Notify users that the facility has reopened and bookings can continue";
    context = `Facility: ${facilityName}`;
  }

  if (kind === "hours_changed") {
    purpose =
      "Inform users that the operating hours of the facility have been updated";
    context = `
Facility: ${facilityName}
Old hours: ${args.oldOpenTime} - ${args.oldCloseTime}
New hours: ${args.newOpenTime} - ${args.newCloseTime}
`;
  }

  return generateAiNotification({
    purpose,
    style: "friendly, helpful, upbeat",
    context,
  });
}
