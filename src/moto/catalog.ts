export type BikeId =
  | 'r15m'
  | 'cbr150r'
  | 'cbr250rr'
  | 'zx25r'
  | 'gsxr150'
  | 'r1m'
  | 's1000rr'
  | 'v4r';

export type ExhaustStyle =
  | 'side-angled'
  | 'dual-port'
  | 'dual-stacked'
  | 'underbelly'
  | 'twin-belly'
  | 'titanium-under-mid';

export type HeadlightStyle =
  | 'mono-projector'
  | 'twin-eye'
  | 'cbr-layered-twin'
  | 'ram-air-twin'
  | 'stacked-vertical'
  | 'r1m-m-duct'
  | 'bmw-split-kidney'
  | 'aero-twin';

export type FrameStyle = 'deltabox' | 'diamond' | 'trellis';

export type ExhaustModId = 'oem' | 'akrapovic-carbon' | 'sc-titanium' | 'dual-underbelly';
export type LightModId = 'ice-white' | 'gold-endurance' | 'neon-cyan' | 'demon-red';
export type ChainModId = 'steel-oem' | 'did-gold' | 'anodized-red' | 'stealth-black';

export interface BikeMods {
  exhaust: ExhaustModId;
  light: LightModId;
  chain: ChainModId;
}

export const DEFAULT_BIKE_MODS: BikeMods = {
  exhaust: 'oem',
  light: 'ice-white',
  chain: 'steel-oem',
};

export interface BikeModPreset {
  id: string;
  name: string;
  mods: BikeMods;
}

export const MOD_PRESETS: BikeModPreset[] = [
  {
    id: 'oem-stock',
    name: 'Standar Pabrik',
    mods: { exhaust: 'oem', light: 'ice-white', chain: 'steel-oem' },
  },
  {
    id: 'street-night',
    name: 'Street Night',
    mods: { exhaust: 'akrapovic-carbon', light: 'neon-cyan', chain: 'did-gold' },
  },
  {
    id: 'track-gp',
    name: 'Track GP Spec',
    mods: { exhaust: 'sc-titanium', light: 'demon-red', chain: 'anodized-red' },
  },
];

export interface ExhaustModSpec {
  id: ExhaustModId;
  name: string;
  shortName: string;
  accelBonus: number;
  topSpeedBonus: number;
  hpBonus: number;
  soundCutoffBoost: number;
  soundGainBoost: number;
}

export interface LightModSpec {
  id: LightModId;
  name: string;
  shortName: string;
  lensColor: string;
  emissiveColor: string;
  drlColor: string;
  swatchHex: string;
}

export interface ChainModSpec {
  id: ChainModId;
  name: string;
  shortName: string;
  linkColor: string;
  pinColor: string;
  sprocketColor: string;
  accelBonus: number;
  swatchHex: string;
}

export const EXHAUST_MODS: ExhaustModSpec[] = [
  {
    id: 'oem',
    name: 'Standar Pabrikan (OEM)',
    shortName: 'Standar',
    accelBonus: 0,
    topSpeedBonus: 0,
    hpBonus: 0,
    soundCutoffBoost: 0,
    soundGainBoost: 0,
  },
  {
    id: 'akrapovic-carbon',
    name: 'Akrapovic Carbon GP',
    shortName: 'Akrapovic',
    accelBonus: 0.9,
    topSpeedBonus: 6,
    hpBonus: 2.4,
    soundCutoffBoost: 240,
    soundGainBoost: 0.014,
  },
  {
    id: 'sc-titanium',
    name: 'SC Project Titanium Shorty',
    shortName: 'SC Project',
    accelBonus: 1.3,
    topSpeedBonus: 9,
    hpBonus: 3.2,
    soundCutoffBoost: 420,
    soundGainBoost: 0.02,
  },
  {
    id: 'dual-underbelly',
    name: 'Twin Underbelly Titanium',
    shortName: 'Twin Belly',
    accelBonus: 1.1,
    topSpeedBonus: 7,
    hpBonus: 2.8,
    soundCutoffBoost: 310,
    soundGainBoost: 0.016,
  },
];

export const LIGHT_MODS: LightModSpec[] = [
  {
    id: 'ice-white',
    name: 'LED Pure White 6000K',
    shortName: 'Putih LED',
    lensColor: '#FFFFFF',
    emissiveColor: '#E0F2FE',
    drlColor: '#BAE6FD',
    swatchHex: '#E0F2FE',
  },
  {
    id: 'gold-endurance',
    name: 'Endurance Fog 3000K',
    shortName: 'Kuning 3000K',
    lensColor: '#FEF08A',
    emissiveColor: '#FACC15',
    drlColor: '#FDE047',
    swatchHex: '#FACC15',
  },
  {
    id: 'neon-cyan',
    name: 'Angel-Eye Cyan Laser',
    shortName: 'Cyan Laser',
    lensColor: '#ECFEFF',
    emissiveColor: '#06B6D4',
    drlColor: '#22D3EE',
    swatchHex: '#22D3EE',
  },
  {
    id: 'demon-red',
    name: 'Demon-Eye Projie Merah',
    shortName: 'Demon Merah',
    lensColor: '#FFE4E6',
    emissiveColor: '#EF4444',
    drlColor: '#F8FAFC',
    swatchHex: '#EF4444',
  },
];

export const CHAIN_MODS: ChainModSpec[] = [
  {
    id: 'steel-oem',
    name: 'Rantai Baja OEM',
    shortName: 'Baja OEM',
    linkColor: '#CBD5E1',
    pinColor: '#64748B',
    sprocketColor: '#94A3B8',
    accelBonus: 0,
    swatchHex: '#CBD5E1',
  },
  {
    id: 'did-gold',
    name: 'DID 520VX3 Gold Racing',
    shortName: 'DID Gold',
    linkColor: '#FBBF24',
    pinColor: '#B45309',
    sprocketColor: '#D97706',
    accelBonus: 0.35,
    swatchHex: '#FBBF24',
  },
  {
    id: 'anodized-red',
    name: 'EK 3D Anodized Red',
    shortName: 'Merah CNC',
    linkColor: '#EF4444',
    pinColor: '#991B1B',
    sprocketColor: '#DC2626',
    accelBonus: 0.3,
    swatchHex: '#EF4444',
  },
  {
    id: 'stealth-black',
    name: 'RK Takasago Black Gold',
    shortName: 'Black Gold',
    linkColor: '#1E293B',
    pinColor: '#F59E0B',
    sprocketColor: '#334155',
    accelBonus: 0.25,
    swatchHex: '#334155',
  },
];

export interface BikeLivery {
  id: string;
  name: string;
  primary: string;
  secondary: string;
  accent: string;
  rimColor: string;
}

export interface MotorcycleSpec {
  id: BikeId;
  brand: string;
  model: string;
  fullName: string;
  category: string;
  displacementCc: number;
  engineType: string;
  cylinders: 1 | 2 | 4;
  horsepowerHp: number;
  torqueNm: number;
  weightKg: number;
  topSpeedKmh: number;
  accelRate: number; // m/s^2 base acceleration
  brakeRate: number; // m/s^2 braking deceleration
  handlingGrip: number; // lateral responsiveness
  maxLeanDeg: number;
  idleRpm: number;
  redlineRpm: number;
  forkColor: string;
  frameStyle: FrameStyle;
  exhaustStyle: ExhaustStyle;
  headlightStyle: HeadlightStyle;
  hasWinglets: boolean;
  tankHeightScale: number;
  fairingWidthScale: number;
  liveries: BikeLivery[];
}

export const MOTORCYCLE_CATALOG: MotorcycleSpec[] = [
  {
    id: 'r15m',
    brand: 'Yamaha',
    model: 'YZF-R15M',
    fullName: 'Yamaha YZF-R15M Connected ABS',
    category: 'Supersport 155cc',
    displacementCc: 155,
    engineType: '1-Silinder SOHC 4-Katup VVA',
    cylinders: 1,
    horsepowerHp: 19.3,
    torqueNm: 14.7,
    weightKg: 140,
    topSpeedKmh: 156,
    accelRate: 11.5,
    brakeRate: 24.0,
    handlingGrip: 1.15,
    maxLeanDeg: 44,
    idleRpm: 1400,
    redlineRpm: 10500,
    forkColor: '#D4AF37', // Gold USD forks
    frameStyle: 'deltabox',
    exhaustStyle: 'side-angled',
    headlightStyle: 'mono-projector',
    hasWinglets: false,
    tankHeightScale: 1.0,
    fairingWidthScale: 0.96,
    liveries: [
      {
        id: 'icon-performance',
        name: 'Icon Performance (Silver Blue)',
        primary: '#C8CFD8',
        secondary: '#111827',
        accent: '#0055D4',
        rimColor: '#0055D4',
      },
      {
        id: 'racing-blue',
        name: 'Yamaha Racing Blue',
        primary: '#0B43B8',
        secondary: '#141923',
        accent: '#38BDF8',
        rimColor: '#0B43B8',
      },
      {
        id: 'wgp-60th',
        name: '60th Anniversary White',
        primary: '#F3F4F6',
        secondary: '#DC2626',
        accent: '#FACC15',
        rimColor: '#D4AF37',
      },
    ],
  },
  {
    id: 'cbr150r',
    brand: 'Honda',
    model: 'CBR150R',
    fullName: 'Honda CBR150R ABS',
    category: 'Sport Fairing 150cc',
    displacementCc: 149,
    engineType: '1-Silinder DOHC 4-Katup Liquid',
    cylinders: 1,
    horsepowerHp: 17.1,
    torqueNm: 14.4,
    weightKg: 139,
    topSpeedKmh: 148,
    accelRate: 10.8,
    brakeRate: 23.5,
    handlingGrip: 1.2,
    maxLeanDeg: 43,
    idleRpm: 1450,
    redlineRpm: 10500,
    forkColor: '#C59B27', // Showa SFF-BP Gold
    frameStyle: 'diamond',
    exhaustStyle: 'dual-port',
    headlightStyle: 'twin-eye',
    hasWinglets: false,
    tankHeightScale: 1.02,
    fairingWidthScale: 1.0,
    liveries: [
      {
        id: 'tricolor',
        name: 'Honda Tricolor HRC',
        primary: '#D91A22',
        secondary: '#F8FAFC',
        accent: '#1D4ED8',
        rimColor: '#1E293B',
      },
      {
        id: 'victory-red',
        name: 'Victory Red Matte',
        primary: '#B91C1C',
        secondary: '#18181B',
        accent: '#F59E0B',
        rimColor: '#18181B',
      },
      {
        id: 'dominator-black',
        name: 'Dominator Matte Black',
        primary: '#1E2026',
        secondary: '#090A0D',
        accent: '#EF4444',
        rimColor: '#DC2626',
      },
    ],
  },
  {
    id: 'cbr250rr',
    brand: 'Honda',
    model: 'CBR250RR',
    fullName: 'Honda CBR250RR SP Quick Shifter',
    category: 'Twin-Cylinder Supersport 250cc',
    displacementCc: 249,
    engineType: '2-Silinder Segaris DOHC 8-Katup',
    cylinders: 2,
    horsepowerHp: 42.0,
    torqueNm: 25.0,
    weightKg: 168,
    topSpeedKmh: 182,
    accelRate: 13.9,
    brakeRate: 25.5,
    handlingGrip: 1.18,
    maxLeanDeg: 46,
    idleRpm: 1450,
    redlineRpm: 14500,
    forkColor: '#D4AF37', // Showa SFF-BP Gold
    frameStyle: 'trellis',
    exhaustStyle: 'dual-stacked',
    headlightStyle: 'cbr-layered-twin',
    hasWinglets: false,
    tankHeightScale: 1.03,
    fairingWidthScale: 1.03,
    liveries: [
      {
        id: 'cbr250-tricolor',
        name: 'Honda HRC Tricolor',
        primary: '#DC2626',
        secondary: '#F8FAFC',
        accent: '#1D4ED8',
        rimColor: '#D4AF37',
      },
      {
        id: 'bravery-red',
        name: 'Bravery Red Black',
        primary: '#B91C1C',
        secondary: '#111318',
        accent: '#F8FAFC',
        rimColor: '#18181B',
      },
      {
        id: 'matte-gunpowder',
        name: 'Matte Gunpowder Black',
        primary: '#23262E',
        secondary: '#0E1014',
        accent: '#F59E0B',
        rimColor: '#D4AF37',
      },
    ],
  },
  {
    id: 'zx25r',
    brand: 'Kawasaki',
    model: 'Ninja ZX-25R',
    fullName: 'Kawasaki Ninja ZX-25RR SE',
    category: 'Inline-4 Supersport 250cc',
    displacementCc: 250,
    engineType: '4-Silinder Segaris DOHC 16-Katup',
    cylinders: 4,
    horsepowerHp: 51.0,
    torqueNm: 22.9,
    weightKg: 182,
    topSpeedKmh: 205,
    accelRate: 15.2,
    brakeRate: 26.0,
    handlingGrip: 1.12,
    maxLeanDeg: 47,
    idleRpm: 1600,
    redlineRpm: 17000,
    forkColor: '#B8973D', // Showa SFF-BP
    frameStyle: 'trellis',
    exhaustStyle: 'underbelly',
    headlightStyle: 'ram-air-twin',
    hasWinglets: true,
    tankHeightScale: 1.06,
    fairingWidthScale: 1.08,
    liveries: [
      {
        id: 'krt-lime',
        name: 'KRT Lime Green',
        primary: '#36B314',
        secondary: '#111317',
        accent: '#E11D48',
        rimColor: '#36B314',
      },
      {
        id: 'metallic-spark',
        name: 'Metallic Spark Black',
        primary: '#191C22',
        secondary: '#0D0F12',
        accent: '#22C55E',
        rimColor: '#334155',
      },
      {
        id: 'pearl-white',
        name: 'Pearl Blizzard White',
        primary: '#E5E7EB',
        secondary: '#1F2937',
        accent: '#36B314',
        rimColor: '#111827',
      },
    ],
  },
  {
    id: 'gsxr150',
    brand: 'Suzuki',
    model: 'GSX-R150',
    fullName: 'Suzuki GSX-R150 Keyless ABS',
    category: 'Lightweight Sport 150cc',
    displacementCc: 147,
    engineType: '1-Silinder DOHC 4-Katup High-Rev',
    cylinders: 1,
    horsepowerHp: 19.2,
    torqueNm: 14.0,
    weightKg: 131,
    topSpeedKmh: 154,
    accelRate: 11.8,
    brakeRate: 24.5,
    handlingGrip: 1.25,
    maxLeanDeg: 45,
    idleRpm: 1500,
    redlineRpm: 11500,
    forkColor: '#252A34', // Black anodized forks
    frameStyle: 'diamond',
    exhaustStyle: 'side-angled',
    headlightStyle: 'stacked-vertical',
    hasWinglets: false,
    tankHeightScale: 0.96,
    fairingWidthScale: 0.92,
    liveries: [
      {
        id: 'triton-blue',
        name: 'Ecstar Triton Blue',
        primary: '#0066CC',
        secondary: '#94A3B8',
        accent: '#CCFF00',
        rimColor: '#0066CC',
      },
      {
        id: 'titan-black',
        name: 'Titan Black Crimson',
        primary: '#18181B',
        secondary: '#27272A',
        accent: '#DC2626',
        rimColor: '#DC2626',
      },
    ],
  },
  {
    id: 'r1m',
    brand: 'Yamaha',
    model: 'YZF-R1M',
    fullName: 'Yamaha YZF-R1M Carbon Ohlins',
    category: 'Superbike 998cc Crossplane',
    displacementCc: 998,
    engineType: '4-Silinder Crossplane CP4 DOHC',
    cylinders: 4,
    horsepowerHp: 200.0,
    torqueNm: 113.3,
    weightKg: 202,
    topSpeedKmh: 299,
    accelRate: 20.6,
    brakeRate: 29.5,
    handlingGrip: 1.15,
    maxLeanDeg: 51,
    idleRpm: 1400,
    redlineRpm: 14000,
    forkColor: '#EAB308', // Ohlins ERS Gold
    frameStyle: 'deltabox',
    exhaustStyle: 'titanium-under-mid',
    headlightStyle: 'r1m-m-duct',
    hasWinglets: false,
    tankHeightScale: 1.07,
    fairingWidthScale: 1.1,
    liveries: [
      {
        id: 'r1m-silver-carbon',
        name: 'Silver Blu Carbon',
        primary: '#D1D5DB',
        secondary: '#14171E',
        accent: '#1D4ED8',
        rimColor: '#1D4ED8',
      },
      {
        id: 'r1m-race-blue',
        name: 'Icon Racing Blue',
        primary: '#0F44B8',
        secondary: '#12151C',
        accent: '#38BDF8',
        rimColor: '#0F44B8',
      },
    ],
  },
  {
    id: 's1000rr',
    brand: 'BMW',
    model: 'M 1000 RR',
    fullName: 'BMW M 1000 RR Competition',
    category: 'Superbike 999cc ShiftCam',
    displacementCc: 999,
    engineType: '4-Silinder ShiftCam Inline-4',
    cylinders: 4,
    horsepowerHp: 212.0,
    torqueNm: 113.0,
    weightKg: 192,
    topSpeedKmh: 306,
    accelRate: 21.2,
    brakeRate: 30.0,
    handlingGrip: 1.17,
    maxLeanDeg: 52,
    idleRpm: 1450,
    redlineRpm: 14600,
    forkColor: '#1F2937', // M Competition Black
    frameStyle: 'deltabox',
    exhaustStyle: 'side-angled',
    headlightStyle: 'bmw-split-kidney',
    hasWinglets: true,
    tankHeightScale: 1.06,
    fairingWidthScale: 1.11,
    liveries: [
      {
        id: 'bmw-m-motorsport',
        name: 'M Motorsport Light White',
        primary: '#F3F4F6',
        secondary: '#111827',
        accent: '#0284C7',
        rimColor: '#1E293B',
      },
      {
        id: 'black-storm',
        name: 'Black Storm Carbon',
        primary: '#191C22',
        secondary: '#0B0D11',
        accent: '#E11D48',
        rimColor: '#DC2626',
      },
      {
        id: 'racing-red-bmw',
        name: 'Racing Red Metallic',
        primary: '#DC2626',
        secondary: '#18181B',
        accent: '#38BDF8',
        rimColor: '#18181B',
      },
    ],
  },
  {
    id: 'v4r',
    brand: 'Ducati',
    model: 'Panigale V4R',
    fullName: 'Ducati Panigale V4 R Superbike',
    category: 'WorldSBK Superbike 998cc',
    displacementCc: 998,
    engineType: '4-Silinder Desmosedici Stradale V4',
    cylinders: 4,
    horsepowerHp: 218.0,
    torqueNm: 111.3,
    weightKg: 193,
    topSpeedKmh: 305,
    accelRate: 21.5,
    brakeRate: 30.0,
    handlingGrip: 1.14,
    maxLeanDeg: 52,
    idleRpm: 1550,
    redlineRpm: 16500,
    forkColor: '#EAB308', // Ohlins NPX Gold
    frameStyle: 'deltabox',
    exhaustStyle: 'twin-belly',
    headlightStyle: 'aero-twin',
    hasWinglets: true,
    tankHeightScale: 1.08,
    fairingWidthScale: 1.12,
    liveries: [
      {
        id: 'rosso-corsa',
        name: 'Ducati Rosso Corsa',
        primary: '#CC0018',
        secondary: '#141417',
        accent: '#F8FAFC',
        rimColor: '#18181B',
      },
      {
        id: 'winter-test',
        name: 'Carbon Winter Test',
        primary: '#1E2025',
        secondary: '#0E0F12',
        accent: '#EF4444',
        rimColor: '#D4AF37',
      },
    ],
  },
];

export function getBikeById(id: BikeId): MotorcycleSpec {
  return MOTORCYCLE_CATALOG.find((b) => b.id === id) ?? MOTORCYCLE_CATALOG[0];
}

export function getExhaustMod(id: ExhaustModId): ExhaustModSpec {
  return EXHAUST_MODS.find((e) => e.id === id) ?? EXHAUST_MODS[0];
}

export function getLightMod(id: LightModId): LightModSpec {
  return LIGHT_MODS.find((l) => l.id === id) ?? LIGHT_MODS[0];
}

export function getChainMod(id: ChainModId): ChainModSpec {
  return CHAIN_MODS.find((c) => c.id === id) ?? CHAIN_MODS[0];
}

export function applyBikeModsToSpec(spec: MotorcycleSpec, mods: BikeMods): MotorcycleSpec {
  const exhaust = getExhaustMod(mods.exhaust);
  const chain = getChainMod(mods.chain);
  return {
    ...spec,
    horsepowerHp: Number((spec.horsepowerHp + exhaust.hpBonus).toFixed(1)),
    topSpeedKmh: spec.topSpeedKmh + exhaust.topSpeedBonus,
    accelRate: Number((spec.accelRate + exhaust.accelBonus + chain.accelBonus).toFixed(2)),
  };
}
