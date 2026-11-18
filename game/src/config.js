// SOLMAR BAY — shared constants: city layout, tuning, palettes, car types.
// One place for every magic number so the systems agree on the world.
export const STEP = 1 / 60;

// City grid: roads run both ways at these coordinates; blocks sit between them.
export const ROAD_LINES = [-180, -120, -60, 0, 60, 120, 180];
export const ROAD_WIDTH = 14;
export const BLOCK = 60; // road-to-road pitch
export const CITY_HALF = 215; // drivable/walkable bounds (square)
export const BEACH_Z = 196; // sand starts here (south edge, +z)
export const WATER_Z = 238; // sea plane starts here
export const DOWNTOWN_R = 95; // blocks inside this radius get towers

// Player tuning
export const PLAYER_WALK = 6.5;
export const PLAYER_SPRINT = 11;
export const PLAYER_JUMP = 8.5;
export const GRAVITY = 22;
export const PLAYER_RADIUS = 0.7;
export const PLAYER_MAX_HEALTH = 100;

// Car types: top speed (m/s), acceleration, grip, handling, seats, body colour range.
export const CAR_TYPES = {
  sedan: { name: 'Sedent Sedan', topSpeed: 30, accel: 14, brake: 26, grip: 8.5, turn: 1.9, mass: 1.0, length: 4.4, width: 1.9, height: 1.05, colors: [0x8a97a3, 0x7d2e2e, 0x2e4a7d, 0x9a8a6a, 0x3a3f44] },
  sports: { name: 'Comet GT', topSpeed: 46, accel: 24, brake: 34, grip: 11, turn: 2.4, mass: 0.8, length: 4.2, width: 1.9, height: 0.85, colors: [0xd8232a, 0xf5c518, 0x22a6d8, 0xe8e8e8, 0x1c1c22] },
  truck: { name: 'Bruto Hauler', topSpeed: 24, accel: 9, brake: 20, grip: 6.5, turn: 1.5, mass: 1.7, length: 5.4, width: 2.1, height: 1.7, colors: [0x5a6b3a, 0x6b5a3a, 0x4a4a52, 0x7d3a2e, 0xd8d8d0] },
  taxi: { name: 'Solmar Cab', topSpeed: 30, accel: 14, brake: 26, grip: 8.5, turn: 1.9, mass: 1.0, length: 4.4, width: 1.9, height: 1.05, colors: [0xf5c518] },
  police: { name: 'SBPD Interceptor', topSpeed: 42, accel: 26, brake: 36, grip: 11.5, turn: 2.5, mass: 0.9, length: 4.4, width: 1.95, height: 1.0, colors: [0x1c2f4a] },
};

// Wanted tuning
export const WANTED_MAX = 5;
export const WANTED_DECAY_SECONDS = 14; // unseen this long, lose a star
export const BUSTED_FINE = 200;
export const WASTED_FINE = 300;

// Sun-soaked palette
export const PALETTE = {
  sky: 0x8ec9ee,
  fog: 0xd8e6ee,
  sun: 0xfff1d0,
  asphalt: 0x3a3f44,
  laneMark: 0xe8e4d2,
  sidewalk: 0xb5ab96,
  sand: 0xe6d29a,
  water: 0x2e9fc4,
  grass: 0x7fae5a,
  building: [0xf2e3c6, 0xe8b48a, 0xa8d0c0, 0xe89a8a, 0xf5f0e0, 0x9ab8d8, 0xd8a05a, 0xc0b8a8],
  glass: [0x6a8fa8, 0x5a7a9a, 0x7a9ab0],
};

// In-game clock: one game minute per real second, starting at 10:00.
export const CLOCK_START_MINUTES = 10 * 60;
export const CLOCK_RATE = 1; // game minutes per real second

export const SAVE_KEY = 'solmar-bay-save-v1';

// Mission start spots and key landmarks, in world coordinates.
export const LANDMARKS = {
  garage: { x: -60, z: -120, label: 'Garage' },
  hideout: { x: 120, z: 120, label: 'Hideout' },
  hospital: { x: -120, z: 60, label: 'Hospital' },
  policeStation: { x: 60, z: -60, label: 'SBPD Station' },
  docks: { x: -180, z: 180, label: 'Bayfront Docks' },
  boardwalk: { x: 0, z: 205, label: 'Boardwalk' },
  plaza: { x: 0, z: 0, label: 'Solmar Plaza' },
};
