// Service Worker — mantiene GPS activo en Android via notificación persistente

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// Recibir mensajes de la app para mostrar/actualizar/cerrar notificación
self.addEventListener('message', (event) => {
  const { type, data } = event.data || {};

  if (type === 'TRIP_START') {
    self.registration.showNotification('TAGcontrol — Viaje en curso', {
      body: 'Detectando peajes automáticamente...',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: 'trip-active',
      ongoing: true,
      requireInteraction: true,
      silent: true,
    });
  }

  if (type === 'TRIP_UPDATE') {
    const { tollCount, totalCost, lastToll } = data || {};
    const body = tollCount > 0
      ? `${tollCount} peaje${tollCount > 1 ? 's' : ''} · $${totalCost?.toLocaleString('es-CL') || 0}${lastToll ? ' · ' + lastToll : ''}`
      : 'Detectando peajes automáticamente...';
    self.registration.showNotification('TAGcontrol — Viaje en curso', {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: 'trip-active',
      ongoing: true,
      requireInteraction: true,
      silent: true,
    });
  }

  if (type === 'TRIP_END') {
    self.registration.getNotifications({ tag: 'trip-active' }).then((notifications) => {
      notifications.forEach((n) => n.close());
    });
  }
});

// Click en notificación → abrir/enfocar la app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      if (clients.length > 0) {
        return clients[0].focus();
      }
      return self.clients.openWindow('/');
    })
  );
});
