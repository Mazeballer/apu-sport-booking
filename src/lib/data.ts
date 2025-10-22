export type SportType =
  | 'Basketball'
  | 'Badminton'
  | 'Tennis'
  | 'Football'
  | 'Volleyball'
  | 'Swimming';
export type LocationType = 'Indoor' | 'Outdoor';

export interface Facility {
  id: string;
  name: string;
  type: SportType;
  location: string;
  locationType: LocationType;
  description: string;
  image: string;
  layoutImage?: string;
  capacity: number;
  rules: string[];
  operatingHours: {
    start: string;
    end: string;
    weekdays?: string;
    weekends?: string;
  };
  pricePerHour?: number;
  courts?: Court[];
  status?: 'active' | 'inactive';
  isMultiSport?: boolean;
  availableEquipment?: AvailableEquipment[];
}

export interface Court {
  id: string;
  name: string;
  layoutImage: string;
  supportedSports?: SportType[];
}

export interface AvailableEquipment {
  equipmentId: string; // Reference to Equipment.id from inventory
  quantity: number; // Quantity available at this facility
}

export interface Equipment {
  id: string;
  name: string;
  facilityId: string;
  qtyAvailable: number;
  qtyTotal: number;
}

export interface Booking {
  id: string;
  facilityId: string;
  userId: string;
  userEmail: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  equipment: string[];
  status: 'confirmed' | 'cancelled';
  createdAt: string;
}

export interface EquipmentRequest {
  id: string;
  userId: string;
  userEmail: string;
  equipmentId: string;
  equipmentName: string;
  facilityId: string;
  facilityName: string;
  requestDate: string;
  status: 'pending' | 'approved' | 'denied' | 'issued' | 'returned';
  notes?: string;
  createdAt: string;
  quantityBorrowed: number; // Total quantity borrowed
  quantityReturned: number; // Quantity returned so far
  returnCondition?: 'good' | 'damaged' | 'lost' | 'not_returned';
  damageNotes?: string;
  returnedAt?: string;
}

export interface EquipmentMaintenance {
  id: string;
  equipmentId: string;
  equipmentName: string;
  facilityId: string;
  requestId: string;
  userEmail: string;
  damageDescription: string;
  reportedAt: string;
  status: 'pending_repair' | 'in_repair' | 'repaired' | 'written_off';
  repairedAt?: string;
  repairNotes?: string;
}

export interface User {
  id: string;
  email: string;
  password: string;
  name: string;
  role: 'student' | 'staff' | 'admin';
  createdAt: string;
}

// Mock data
export const facilities: Facility[] = [
  {
    id: '1',
    name: 'Basketball Court A',
    type: 'Basketball',
    location: 'Sports Complex, Level 1',
    locationType: 'Indoor',
    description:
      'Full-size indoor basketball court with professional flooring and adjustable hoops.',
    image: '/indoor-basketball-court-professional-lighting.jpg',
    layoutImage: '/court-layout-basketball.jpg',
    capacity: 10,
    rules: [
      'Maximum 10 players per session',
      'Proper sports attire required',
      'No outside food or drinks (water allowed)',
      'Equipment must be returned after use',
    ],
    operatingHours: {
      start: '07:00',
      end: '22:00',
      weekdays: '7:00 AM - 10:00 PM',
      weekends: '8:00 AM - 8:00 PM',
    },
    courts: [
      {
        id: 'c1',
        name: 'Court 1',
        layoutImage: '/court-layout-basketball.jpg',
      },
      {
        id: 'c2',
        name: 'Court 2',
        layoutImage: '/court-layout-basketball.jpg',
      },
      {
        id: 'c3',
        name: 'Court 3',
        layoutImage: '/court-layout-basketball.jpg',
      },
    ],
    status: 'active',
    isMultiSport: false,
    availableEquipment: [
      { equipmentId: 'eq1', quantity: 8 },
      { equipmentId: 'eq2', quantity: 2 },
    ],
  },
  {
    id: '2',
    name: 'Badminton Hall',
    type: 'Badminton',
    location: 'Sports Complex B',
    locationType: 'Indoor',
    description:
      'Multi-court badminton hall with 6 courts available for booking.',
    image: '/badminton-hall-indoor-courts.jpg',
    layoutImage: '/court-layout-badminton.jpg',
    capacity: 24,
    rules: [
      'Non-marking shoes required',
      'Book per court (4 players max)',
      'Bring your own equipment or rent from desk',
      'No outside coaching without permission',
    ],
    operatingHours: {
      start: '07:00',
      end: '23:00',
      weekdays: '7:00 AM - 11:00 PM',
      weekends: '8:00 AM - 10:00 PM',
    },
    courts: [
      { id: 'c1', name: 'Court 1', layoutImage: '/court-layout-badminton.jpg' },
      { id: 'c2', name: 'Court 2', layoutImage: '/court-layout-badminton.jpg' },
      { id: 'c3', name: 'Court 3', layoutImage: '/court-layout-badminton.jpg' },
      { id: 'c4', name: 'Court 4', layoutImage: '/court-layout-badminton.jpg' },
    ],
    status: 'active',
    isMultiSport: false,
    availableEquipment: [
      { equipmentId: 'eq3', quantity: 0 },
      { equipmentId: 'eq4', quantity: 8 },
    ],
  },
  {
    id: '3',
    name: 'Tennis Courts',
    type: 'Tennis',
    location: 'Outdoor Sports Area',
    locationType: 'Outdoor',
    description: 'Two outdoor tennis courts with night lighting available.',
    image: '/outdoor-tennis-courts-evening-lighting.jpg',
    layoutImage: '/court-layout-tennis.jpg',
    capacity: 8,
    rules: [
      'Tennis shoes required',
      'Book per court (4 players max)',
      'Courts close during rain',
      'Turn off lights after use',
    ],
    operatingHours: {
      start: '06:00',
      end: '22:00',
      weekdays: '6:00 AM - 10:00 PM',
      weekends: '7:00 AM - 9:00 PM',
    },
    courts: [
      { id: 'c1', name: 'Court 1', layoutImage: '/court-layout-tennis.jpg' },
      { id: 'c2', name: 'Court 2', layoutImage: '/court-layout-tennis.jpg' },
    ],
    status: 'active',
    isMultiSport: false,
    availableEquipment: [
      { equipmentId: 'eq5', quantity: 4 },
      { equipmentId: 'eq6', quantity: 6 },
    ],
  },
  {
    id: '4',
    name: 'Football Field',
    type: 'Football',
    location: 'Main Field',
    locationType: 'Outdoor',
    description:
      'Full-size football field with artificial turf and floodlights.',
    image: '/football-field-artificial-turf-floodlights.jpg',
    layoutImage: '/court-layout-football.jpg',
    capacity: 30,
    rules: [
      'Cleats or turf shoes only',
      'Maximum 30 players',
      'No metal studs allowed',
      'Report any damage immediately',
    ],
    operatingHours: {
      start: '06:00',
      end: '21:00',
      weekdays: '6:00 AM - 9:00 PM',
      weekends: '7:00 AM - 8:00 PM',
    },
    courts: [
      {
        id: 'c1',
        name: 'Main Field',
        layoutImage: '/court-layout-football.jpg',
      },
    ],
    status: 'active',
    isMultiSport: false,
    availableEquipment: [
      { equipmentId: 'eq7', quantity: 3 },
      { equipmentId: 'eq8', quantity: 10 },
    ],
  },
  {
    id: '5',
    name: 'Swimming Pool',
    type: 'Swimming',
    location: 'Aquatic Center',
    locationType: 'Indoor',
    description: 'Olympic-size swimming pool with 8 lanes and diving area.',
    image: '/olympic-swimming-pool-indoor-lanes.jpg',
    layoutImage: '/court-layout-pool.jpg',
    capacity: 50,
    rules: [
      'Swim attire mandatory',
      'Shower before entering',
      'No diving in shallow end',
      'Lifeguard must be present',
    ],
    operatingHours: {
      start: '06:00',
      end: '20:00',
      weekdays: '6:00 AM - 8:00 PM',
      weekends: '8:00 AM - 6:00 PM',
    },
    courts: [
      {
        id: 'c1',
        name: 'Pool Lanes 1-8',
        layoutImage: '/court-layout-pool.jpg',
      },
    ],
    status: 'active',
    isMultiSport: false,
    availableEquipment: [],
  },
];

export const equipment: Equipment[] = [
  {
    id: 'eq1',
    name: 'Basketball',
    facilityId: '1',
    qtyAvailable: 8,
    qtyTotal: 10,
  },
  {
    id: 'eq2',
    name: 'Scoreboard Remote',
    facilityId: '1',
    qtyAvailable: 2,
    qtyTotal: 3,
  },
  {
    id: 'eq3',
    name: 'Badminton Racket',
    facilityId: '2',
    qtyAvailable: 0,
    qtyTotal: 12,
  },
  {
    id: 'eq4',
    name: 'Shuttlecock (tube)',
    facilityId: '2',
    qtyAvailable: 8,
    qtyTotal: 15,
  },
  {
    id: 'eq5',
    name: 'Tennis Racket',
    facilityId: '3',
    qtyAvailable: 4,
    qtyTotal: 8,
  },
  {
    id: 'eq6',
    name: 'Tennis Balls (can)',
    facilityId: '3',
    qtyAvailable: 6,
    qtyTotal: 10,
  },
  {
    id: 'eq7',
    name: 'Football',
    facilityId: '4',
    qtyAvailable: 3,
    qtyTotal: 8,
  },
  {
    id: 'eq8',
    name: 'Training Cones',
    facilityId: '4',
    qtyAvailable: 10,
    qtyTotal: 20,
  },
];

// Generate some future bookings
const today = new Date();
export const bookings: Booking[] = [
  {
    id: 'b1',
    facilityId: '1',
    userId: 'user1',
    userEmail: 'student@mail.apu.edu.my',
    date: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0],
    startTime: '14:00',
    endTime: '16:00',
    duration: 2,
    equipment: ['Basketball', 'Scoreboard Remote'],
    status: 'confirmed',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'b2',
    facilityId: '2',
    userId: 'user1',
    userEmail: 'student@mail.apu.edu.my',
    date: new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0],
    startTime: '18:00',
    endTime: '19:00',
    duration: 1,
    equipment: [],
    status: 'confirmed',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'b3',
    facilityId: '3',
    userId: 'user1',
    userEmail: 'student@mail.apu.edu.my',
    date: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0],
    startTime: '09:00',
    endTime: '11:00',
    duration: 2,
    equipment: ['Tennis Racket', 'Tennis Balls (can)'],
    status: 'confirmed',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'b4',
    facilityId: '4',
    userId: 'user1',
    userEmail: 'student@mail.apu.edu.my',
    date: new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0],
    startTime: '16:00',
    endTime: '18:00',
    duration: 2,
    equipment: ['Football', 'Training Cones'],
    status: 'confirmed',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'b5',
    facilityId: '5',
    userId: 'user1',
    userEmail: 'student@mail.apu.edu.my',
    date: new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0],
    startTime: '07:00',
    endTime: '08:00',
    duration: 1,
    equipment: [],
    status: 'confirmed',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'b6',
    facilityId: '1',
    userId: 'user1',
    userEmail: 'student@mail.apu.edu.my',
    date: new Date(today.getTime() + 21 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0],
    startTime: '20:00',
    endTime: '22:00',
    duration: 2,
    equipment: ['Basketball'],
    status: 'confirmed',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'b7',
    facilityId: '1',
    userId: 'staff1',
    userEmail: 'staff@mail.apu.edu.my',
    date: new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0],
    startTime: '10:00',
    endTime: '12:00',
    duration: 2,
    equipment: ['Basketball', 'Scoreboard Remote'],
    status: 'confirmed',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'b8',
    facilityId: '2',
    userId: 'staff1',
    userEmail: 'staff@mail.apu.edu.my',
    date: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0],
    startTime: '15:00',
    endTime: '17:00',
    duration: 2,
    equipment: ['Badminton Racket', 'Shuttlecock (tube)'],
    status: 'confirmed',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'b9',
    facilityId: '3',
    userId: 'staff1',
    userEmail: 'staff@mail.apu.edu.my',
    date: new Date(today.getTime() + 6 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0],
    startTime: '08:00',
    endTime: '09:00',
    duration: 1,
    equipment: [],
    status: 'confirmed',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'b10',
    facilityId: '4',
    userId: 'staff1',
    userEmail: 'staff@mail.apu.edu.my',
    date: new Date(today.getTime() + 8 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0],
    startTime: '17:00',
    endTime: '19:00',
    duration: 2,
    equipment: ['Football'],
    status: 'confirmed',
    createdAt: new Date().toISOString(),
  },
];

// Generate some equipment requests
export const equipmentRequests: EquipmentRequest[] = [
  {
    id: 'er1',
    userId: 'user1',
    userEmail: 'student@mail.apu.edu.my',
    equipmentId: 'eq3',
    equipmentName: 'Badminton Racket',
    facilityId: '2',
    facilityName: 'Badminton Hall',
    requestDate: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0],
    status: 'pending',
    notes: 'Need 2 rackets for doubles match',
    createdAt: new Date(
      today.getTime() - 1 * 24 * 60 * 60 * 1000
    ).toISOString(),
    quantityBorrowed: 2,
    quantityReturned: 0,
  },
  {
    id: 'er2',
    userId: 'user1',
    userEmail: 'student@mail.apu.edu.my',
    equipmentId: 'eq1',
    equipmentName: 'Basketball',
    facilityId: '1',
    facilityName: 'Basketball Court A',
    requestDate: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0],
    status: 'approved',
    notes: 'For team practice session',
    createdAt: new Date(
      today.getTime() - 2 * 24 * 60 * 60 * 1000
    ).toISOString(),
    quantityBorrowed: 3,
    quantityReturned: 0,
  },
  {
    id: 'er3',
    userId: 'user1',
    userEmail: 'student@mail.apu.edu.my',
    equipmentId: 'eq5',
    equipmentName: 'Tennis Racket',
    facilityId: '3',
    facilityName: 'Tennis Courts',
    requestDate: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0],
    status: 'issued',
    notes: 'Weekend tournament',
    createdAt: new Date(
      today.getTime() - 5 * 24 * 60 * 60 * 1000
    ).toISOString(),
    quantityBorrowed: 2,
    quantityReturned: 0,
  },
  {
    id: 'er4',
    userId: 'user1',
    userEmail: 'student@mail.apu.edu.my',
    equipmentId: 'eq7',
    equipmentName: 'Football',
    facilityId: '4',
    facilityName: 'Football Field',
    requestDate: new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0],
    status: 'returned',
    notes: 'Training session completed',
    createdAt: new Date(
      today.getTime() - 10 * 24 * 60 * 60 * 1000
    ).toISOString(),
    quantityBorrowed: 1,
    quantityReturned: 1,
  },
  {
    id: 'er5',
    userId: 'user1',
    userEmail: 'student@mail.apu.edu.my',
    equipmentId: 'eq4',
    equipmentName: 'Shuttlecock (tube)',
    facilityId: '2',
    facilityName: 'Badminton Hall',
    requestDate: new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0],
    status: 'denied',
    notes: 'Need for club activity',
    createdAt: new Date(
      today.getTime() - 1 * 24 * 60 * 60 * 1000
    ).toISOString(),
    quantityBorrowed: 5,
    quantityReturned: 0,
  },
  {
    id: 'er6',
    userId: 'user1',
    userEmail: 'student@mail.apu.edu.my',
    equipmentId: 'eq2',
    equipmentName: 'Scoreboard Remote',
    facilityId: '1',
    facilityName: 'Basketball Court A',
    requestDate: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0],
    status: 'approved',
    createdAt: new Date(
      today.getTime() - 1 * 24 * 60 * 60 * 1000
    ).toISOString(),
    quantityBorrowed: 1,
    quantityReturned: 0,
  },
  {
    id: 'er7',
    userId: 'staff1',
    userEmail: 'staff@mail.apu.edu.my',
    equipmentId: 'eq1',
    equipmentName: 'Basketball',
    facilityId: '1',
    facilityName: 'Basketball Court A',
    requestDate: new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0],
    status: 'approved',
    notes: 'For staff training session',
    createdAt: new Date(
      today.getTime() - 1 * 24 * 60 * 60 * 1000
    ).toISOString(),
    quantityBorrowed: 2,
    quantityReturned: 0,
  },
  {
    id: 'er8',
    userId: 'staff1',
    userEmail: 'staff@mail.apu.edu.my',
    equipmentId: 'eq3',
    equipmentName: 'Badminton Racket',
    facilityId: '2',
    facilityName: 'Badminton Hall',
    requestDate: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0],
    status: 'pending',
    notes: 'Staff recreation activity',
    createdAt: new Date(
      today.getTime() - 2 * 24 * 60 * 60 * 1000
    ).toISOString(),
    quantityBorrowed: 4,
    quantityReturned: 0,
  },
  {
    id: 'er9',
    userId: 'staff1',
    userEmail: 'staff@mail.apu.edu.my',
    equipmentId: 'eq5',
    equipmentName: 'Tennis Racket',
    facilityId: '3',
    facilityName: 'Tennis Courts',
    requestDate: new Date(today.getTime() + 6 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0],
    status: 'issued',
    notes: 'Morning tennis session',
    createdAt: new Date(
      today.getTime() - 3 * 24 * 60 * 60 * 1000
    ).toISOString(),
    quantityBorrowed: 2,
    quantityReturned: 1,
  },
  {
    id: 'er10',
    userId: 'staff1',
    userEmail: 'staff@mail.apu.edu.my',
    equipmentId: 'eq7',
    equipmentName: 'Football',
    facilityId: '4',
    facilityName: 'Football Field',
    requestDate: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0],
    status: 'returned',
    notes: 'Staff vs students match',
    createdAt: new Date(
      today.getTime() - 7 * 24 * 60 * 60 * 1000
    ).toISOString(),
    quantityBorrowed: 1,
    quantityReturned: 1,
  },
  {
    id: 'er11',
    userId: 'staff1',
    userEmail: 'staff@mail.apu.edu.my',
    equipmentId: 'eq2',
    equipmentName: 'Scoreboard Remote',
    facilityId: '1',
    facilityName: 'Basketball Court A',
    requestDate: new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0],
    status: 'approved',
    notes: 'Need for tournament setup',
    createdAt: new Date(
      today.getTime() - 1 * 24 * 60 * 60 * 1000
    ).toISOString(),
    quantityBorrowed: 1,
    quantityReturned: 0,
  },
];

export const equipmentMaintenance: EquipmentMaintenance[] = [];

export const users: User[] = [
  {
    id: 'u1',
    email: 'admin@mail.apu.edu.my',
    password: 'admin123',
    name: 'Admin User',
    role: 'admin',
    createdAt: new Date(
      today.getTime() - 365 * 24 * 60 * 60 * 1000
    ).toISOString(),
  },
  {
    id: 'u2',
    email: 'staff@mail.apu.edu.my',
    password: 'staff123',
    name: 'Staff Member',
    role: 'staff',
    createdAt: new Date(
      today.getTime() - 180 * 24 * 60 * 60 * 1000
    ).toISOString(),
  },
  {
    id: 'u3',
    email: 'student@mail.apu.edu.my',
    password: 'student123',
    name: 'Student User',
    role: 'student',
    createdAt: new Date(
      today.getTime() - 90 * 24 * 60 * 60 * 1000
    ).toISOString(),
  },
  {
    id: 'u4',
    email: 'john.doe@mail.apu.edu.my',
    password: 'password123',
    name: 'John Doe',
    role: 'student',
    createdAt: new Date(
      today.getTime() - 60 * 24 * 60 * 60 * 1000
    ).toISOString(),
  },
  {
    id: 'u5',
    email: 'jane.smith@mail.apu.edu.my',
    password: 'password123',
    name: 'Jane Smith',
    role: 'student',
    createdAt: new Date(
      today.getTime() - 45 * 24 * 60 * 60 * 1000
    ).toISOString(),
  },
  {
    id: 'u6',
    email: 'coach.wilson@mail.apu.edu.my',
    password: 'coach123',
    name: 'Coach Wilson',
    role: 'staff',
    createdAt: new Date(
      today.getTime() - 120 * 24 * 60 * 60 * 1000
    ).toISOString(),
  },
];
