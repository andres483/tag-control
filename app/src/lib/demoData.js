import * as SecureStore from 'expo-secure-store';

const USER_KEY = 'tagcontrol_user';

export const DEMO_USER = {
  id: 'demo-local',
  name: 'Demo',
  email: 'demo@tagcontrol.app',
  isDemo: true,
};

// 5 viajes · 12 peajes · CLP $16.694 — igual que las review notes
const now = Date.now();
const day = 86400000;

export const DEMO_TRIPS = [
  {
    id: 'demo-trip-1',
    driver: 'Demo',
    startTime: now - 5 * day,
    endTime: now - 5 * day + 3600000,
    totalCost: 4820,
    tollCount: 3,
    routes: ['Ruta 68'],
    crossings: [
      { tollNombre: 'Las Vegas', tollRuta: 'Ruta 68', tarifa: 2100, timestamp: now - 5 * day + 20 * 60000 },
      { tollNombre: 'Zapata', tollRuta: 'Ruta 68', tarifa: 1360, timestamp: now - 5 * day + 38 * 60000 },
      { tollNombre: 'Lo Prado', tollRuta: 'Ruta 68', tarifa: 1360, timestamp: now - 5 * day + 54 * 60000 },
    ],
  },
  {
    id: 'demo-trip-2',
    driver: 'Demo',
    startTime: now - 8 * day,
    endTime: now - 8 * day + 2700000,
    totalCost: 3320,
    tollCount: 2,
    routes: ['Costanera Norte'],
    crossings: [
      { tollNombre: 'Túnel San Cristóbal', tollRuta: 'Costanera Norte', tarifa: 1660, timestamp: now - 8 * day + 12 * 60000 },
      { tollNombre: 'Avenida El Salto', tollRuta: 'Costanera Norte', tarifa: 1660, timestamp: now - 8 * day + 28 * 60000 },
    ],
  },
  {
    id: 'demo-trip-3',
    driver: 'Demo',
    startTime: now - 11 * day,
    endTime: now - 11 * day + 4200000,
    totalCost: 4380,
    tollCount: 3,
    routes: ['Autopista Central'],
    crossings: [
      { tollNombre: 'Franklin', tollRuta: 'Autopista Central', tarifa: 1460, timestamp: now - 11 * day + 15 * 60000 },
      { tollNombre: 'Lo Ovalle', tollRuta: 'Autopista Central', tarifa: 1460, timestamp: now - 11 * day + 32 * 60000 },
      { tollNombre: 'Kennedy', tollRuta: 'Autopista Central', tarifa: 1460, timestamp: now - 11 * day + 48 * 60000 },
    ],
  },
  {
    id: 'demo-trip-4',
    driver: 'Demo',
    startTime: now - 15 * day,
    endTime: now - 15 * day + 3200000,
    totalCost: 2720,
    tollCount: 2,
    routes: ['Ruta 68'],
    crossings: [
      { tollNombre: 'Las Vegas', tollRuta: 'Ruta 68', tarifa: 1360, timestamp: now - 15 * day + 18 * 60000 },
      { tollNombre: 'Zapata', tollRuta: 'Ruta 68', tarifa: 1360, timestamp: now - 15 * day + 35 * 60000 },
    ],
  },
  {
    id: 'demo-trip-5',
    driver: 'Demo',
    startTime: now - 20 * day,
    endTime: now - 20 * day + 2400000,
    totalCost: 1454,
    tollCount: 2,
    routes: ['Costanera Norte'],
    crossings: [
      { tollNombre: 'Avenida El Salto', tollRuta: 'Costanera Norte', tarifa: 730, timestamp: now - 20 * day + 10 * 60000 },
      { tollNombre: 'Américo Vespucio', tollRuta: 'Costanera Norte', tarifa: 724, timestamp: now - 20 * day + 24 * 60000 },
    ],
  },
];

export async function demoLogin() {
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(DEMO_USER));
  return DEMO_USER;
}
