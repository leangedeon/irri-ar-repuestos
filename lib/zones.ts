// Zonas del pivot que se pueden señalar en el visor 3D.
// Este archivo no depende del servidor: lo usan el visor (cliente) y el catálogo (servidor).

export const ZONES = [
  'punto',
  'colector',
  'tablero',
  'tramo',
  'cercha',
  'cable',
  'torre',
  'cajaTorre',
  'motor',
  'reductor',
  'rueda',
  'bajante',
  'aspersor',
  'canon',
] as const;

export type Zone = (typeof ZONES)[number];
export const isZone = (z: string): z is Zone => (ZONES as readonly string[]).includes(z);

export const ZONE_LABEL: Record<'es' | 'en', Record<Zone, string>> = {
  es: {
    punto: 'Punto pivote',
    colector: 'Anillo colector y codo',
    tablero: 'Tablero de control',
    tramo: 'Caño de tramo y juntas',
    cercha: 'Cerchas y tensores',
    cable: 'Cable de tramo',
    torre: 'Estructura de torre',
    cajaTorre: 'Caja de torre y alineación',
    motor: 'Motorreductor central',
    reductor: 'Cajas reductoras y cardanes',
    rueda: 'Ruedas y llantas',
    bajante: 'Bajantes y mangueras',
    aspersor: 'Aspersores y reguladores',
    canon: 'Cañón final y bomba booster',
  },
  en: {
    punto: 'Pivot point',
    colector: 'Collector ring & elbow',
    tablero: 'Control panel',
    tramo: 'Span pipe & joints',
    cercha: 'Trusses & rods',
    cable: 'Span cable',
    torre: 'Tower structure',
    cajaTorre: 'Tower box & alignment',
    motor: 'Center drive',
    reductor: 'Gearboxes & U-joints',
    rueda: 'Wheels & tires',
    bajante: 'Drops & hoses',
    aspersor: 'Sprinklers & regulators',
    canon: 'End gun & booster pump',
  },
};

// Reglas por nombre de categoría (en inglés, el original de Lindsay). La primera que coincide gana.
// Una categoría sin regla hereda la zona de su categoría madre.
const CAT_RULES: [RegExp, Zone | null][] = [
  // Cosas que no son del equipo en sí: sin vista previa aunque la madre tenga zona.
  [/weather station|soil moisture|rainbucket|display|parts board|poster|decal|paint|tool|lubricant|sealant|tape|bags?$/i, null],
  [/end ?guns?|booster pump/i, 'canon'],
  [/span cable|motor drop cable|electric cable|^cables?$/i, 'cable'],
  [/drop span/i, 'tramo'],
  [/sprinkler hose|\bdrops?\b|weights?$/i, 'bajante'],
  [/sprinkler|nozzle|regulator/i, 'aspersor'],
  [/collector ring|swivel/i, 'colector'],
  [/tower box|tower control|tower panel|alignment|tower watch|switches/i, 'cajaTorre'],
  [/center ?drives?|centerdrives?/i, 'motor'],
  [/wheel assembl|wheels?$|tires?/i, 'rueda'],
  [/gearbox|u-joints?|drive ?shaft|drive tubes?|drive couplers?|driveshaft|drive train|drivetrain|gear oil|^oil$/i, 'reductor'],
  [/truss|stabilizer|anchor rods?/i, 'cercha'],
  [/tower parts|^towers?$/i, 'torre'],
  [/pivot point conversion joint|span conversion|galvanized pipe|span pipe|joints?$|coupler halves|boot|extension kits?|span hardware|overhang|tubing|saddle clamp/i, 'tramo'],
  [/pivot points?|pivot point|pump to pivot|pivot hardware/i, 'punto'],
  [/main control panel|pivot panel|pivot control|fieldnet|fieldlink|contactors?|fuses?|relays?|timers|terminal blocks?|transformers?|indicators? lights|resistors?|din rail|disconnects|arrestors|rotophases|vfd|variable frequency|^panels$|^electrical$/i, 'tablero'],
];

export function zoneOfCategory(name: string): Zone | null | undefined {
  for (const [re, z] of CAT_RULES) if (re.test(name)) return z;
  return undefined; // sin regla: hereda
}

// Para productos de categorías genéricas (bulonería, plomería, blísters…): reglas por nombre del producto.
const NAME_RULES: [RegExp, Zone][] = [
  [/end ?gun|booster/i, 'canon'],
  [/sprinkler|nozzle|regulator|rotator|spray|nelson|senninger|\bi-wob|\bwob\b/i, 'aspersor'],
  [/\bdrop\b|drop hose|hose drop|gooseneck|goose neck/i, 'bajante'],
  [/collector/i, 'colector'],
  [/tower box|microswitch|micro switch|alignment/i, 'cajaTorre'],
  [/span cable/i, 'cable'],
  [/center ?drive|ctr ?drive|\bmotor\b/i, 'motor'],
  [/gearbox|gear box|u-joint|ujoint|drive ?shaft|drivetube|drive tube/i, 'reductor'],
  [/\btire\b|\bwheel\b|\brim\b/i, 'rueda'],
  [/truss/i, 'cercha'],
];

export function zoneOfName(name: string): Zone | undefined {
  for (const [re, z] of NAME_RULES) if (re.test(name)) return z;
  return undefined;
}
