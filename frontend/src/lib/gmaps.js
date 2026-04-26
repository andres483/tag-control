/* global google */
import { haversine } from './geoUtils';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY;

/**
 * Carga el script de Google Maps si no está cargado.
 */
let loadPromise = null;
export function loadGoogleMaps() {
  if (loadPromise) return loadPromise;
  if (window.google?.maps) return Promise.resolve();

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places`;
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return loadPromise;
}

/**
 * Obtiene la ruta entre dos puntos usando Directions API.
 * Retorna la ruta como array de coordenadas {lat, lng}.
 */
export async function getRoute(origin, destination) {
  await loadGoogleMaps();

  return new Promise((resolve, reject) => {
    const service = new google.maps.DirectionsService();
    service.route(
      {
        origin,
        destination,
        travelMode: google.maps.TravelMode.DRIVING,
        provideRouteAlternatives: true,
        region: 'cl',
      },
      (result, status) => {
        if (status === 'OK') {
          resolve(result.routes.map((route) => ({
            summary: route.summary,
            distance: route.legs[0].distance,
            duration: route.legs[0].duration,
            path: route.overview_path.map((p) => ({
              lat: p.lat(),
              lng: p.lng(),
            })),
          })));
        } else {
          reject(new Error(`Directions API: ${status}`));
        }
      }
    );
  });
}

/**
 * Calcula la distancia mínima entre un punto y una polilínea (ruta).
 * Retorna la distancia en metros.
 */
function distanceToRoute(point, routePath) {
  let minDist = Infinity;
  for (const p of routePath) {
    const d = haversine(point.lat, point.lng, p.lat, p.lng);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

/**
 * Encuentra qué peajes de la base de datos están en una ruta dada.
 * Un peaje está "en la ruta" si está a menos de su radio de detección de algún punto.
 */
export function findTollsOnRoute(routePath, tolls, maxDistance = 500) {
  const found = [];
  for (const toll of tolls) {
    const dist = distanceToRoute(toll, routePath);
    if (dist <= maxDistance) {
      found.push({ ...toll, distanceToRoute: Math.round(dist) });
    }
  }

  // Ordenar por aparición en la ruta
  found.sort((a, b) => {
    const idxA = findClosestIndex(routePath, a);
    const idxB = findClosestIndex(routePath, b);
    return idxA - idxB;
  });

  return found;
}

function findClosestIndex(path, point) {
  let minDist = Infinity;
  let minIdx = 0;
  for (let i = 0; i < path.length; i++) {
    const d = haversine(point.lat, point.lng, path[i].lat, path[i].lng);
    if (d < minDist) {
      minDist = d;
      minIdx = i;
    }
  }
  return minIdx;
}
