export type SportType =
  | "Basketball"
  | "Badminton"
  | "Tennis"
  | "Football"
  | "Volleyball"
  | "Swimming"
  | string

export type LocationType = "Indoor" | "Outdoor"

export type AvailableEquipment = {
  equipmentId: string
  quantity: number
}

export type CourtUi = {
  id: string
  name: string
  layoutImage?: string
  supportedSports: SportType[]
}

export type Facility = {
  id: string
  name: string
  type: SportType
  location: string
  locationType: LocationType
  description: string
  image: string
  layoutImage: string
  capacity: number
  rules: string[]
  operatingHours: {
    start: string
    end: string
  }
  courts: CourtUi[]
  status: "active" | "inactive"
  isMultiSport: boolean
  availableEquipment: AvailableEquipment[]
}
