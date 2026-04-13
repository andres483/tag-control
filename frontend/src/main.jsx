import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// Limpiar service worker viejo
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const reg of registrations) reg.unregister();
  });
  caches.keys().then((keys) => {
    for (const key of keys) caches.delete(key);
  });
}

// Auto-refresh: chequear nueva versión cada 2 minutos
// Compara el HTML para detectar nuevos bundles (Vite genera hashes únicos)
let currentHtml = null;
async function checkForUpdate() {
  try {
    const res = await fetch('/?_v=' + Date.now(), { cache: 'no-store' });
    const html = await res.text();
    // Extraer los script/css filenames del HTML
    const assets = html.match(/assets\/[^"']+/g)?.join(',') || '';
    if (currentHtml === null) {
      currentHtml = assets;
    } else if (assets && assets !== currentHtml) {
      window.location.reload();
    }
  } catch {}
}
checkForUpdate();
setInterval(checkForUpdate, 120000);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
