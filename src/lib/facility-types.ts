export type SportType =
  | "Basketball"
  | "Badminton"
  | "Tennis"
  | "Football"
  | "Volleyball"
  | "Swimming"
  | string;

export type LocationType = "Indoor" | "Outdoor";

export type AvailableEquipment = {
  equipmentId: string;
  quantity: number;
};

export type CourtUi = {
  id: string;
  name: string;
  layoutImage?: string;
  supportedSports: SportType[];
};

export type FacilityCardData = {
  id: string;
  name: string;
  type: SportType;
  location: string;
  locationType: LocationType;
  description?: string | null;
  capacity?: number | null;
  photos?: string[]; // first item used as cover
  openTime?: string | null; // "07:00"
  closeTime?: string | null; // "22:00"
  active?: boolean; // optional for badges or filtering
  isMultiSport?: boolean;
  sharedSports?: string[];
  numberOfCourts?: number;
  rules?: string[] | string | null; // tolerate both until you fully normalize
};
