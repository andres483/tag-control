/**
 * Background service — mantiene la PWA viva en Android (notificación persistente)
 * y en iOS (audio keep-alive). Abstrae la lógica de plataforma.
 */

let swRegistration = null;
let notificationGranted = false;
let updateInterval = null;

/**
 * Registra el Service Worker. Llamar una vez al cargar la app.
 */
export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    swRegistration = await navigator.serviceWorker.register('/sw.js');
    // Esperar a que el SW esté activo
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) => {
        navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true });
        // Timeout por si ya está activo
        setTimeout(resolve, 2000);
      });
    }
  } catch {}
}

/**
 * Pide permiso de notificaciones (necesario para Android background).
 * Llamar desde un gesto del usuario (ej: botón "Iniciar viaje").
 * Retorna true si se otorgó el permiso.
 */
export async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') {
    notificationGranted = true;
    return true;
  }
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  notificationGranted = result === 'granted';
  return notificationGranted;
}

/**
 * Inicia el modo background: notificación persistente (Android) + keep-alive.
 */
export function startBackgroundService() {
  if (!swRegistration?.active) return;
  if (!notificationGranted && Notification.permission !== 'granted') return;

  swRegistration.active.postMessage({ type: 'TRIP_START' });
}

/**
 * Actualiza la notificación con el estado actual del viaje.
 * Llamar cada vez que cambia el estado (nuevo peaje, etc).
 */
export function updateBackgroundNotification({ tollCount, totalCost, lastToll }) {
  if (!swRegistration?.active) return;
  if (Notification.permission !== 'granted') return;

  swRegistration.active.postMessage({
    type: 'TRIP_UPDATE',
    data: { tollCount, totalCost, lastToll },
  });
}

/**
 * Inicia actualización periódica de la notificación (keepalive para Android).
 * El callback debe retornar { tollCount, totalCost, lastToll }.
 */
export function startNotificationUpdates(getState) {
  stopNotificationUpdates();
  // Actualizar cada 30s para mantener el SW activo
  updateInterval = setInterval(() => {
    const state = getState();
    if (state) updateBackgroundNotification(state);
  }, 30000);
}

export function stopNotificationUpdates() {
  if (updateInterval) {
    clearInterval(updateInterval);
    updateInterval = null;
  }
}

/**
 * Detiene el modo background: cierra notificación y limpia.
 */
export function stopBackgroundService() {
  stopNotificationUpdates();
  if (!swRegistration?.active) return;
  swRegistration.active.postMessage({ type: 'TRIP_END' });
}

/**
 * Detecta si estamos en Android (para decidir si pedir notificaciones).
 */
export function isAndroid() {
  return /android/i.test(navigator.userAgent);
}
