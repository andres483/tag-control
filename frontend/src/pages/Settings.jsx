import { useState, useEffect } from 'react';
import { getActiveTrips, getTripCrossings, subscribeLiveTrips } from '../lib/liveTracking';
import { formatCLP, formatTime } from '../lib/format';

export default function Settings() {
  const [trips, setTrips] = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [crossings, setCrossings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Cargar viajes activos
  async function loadTrips() {
    const active = await getActiveTrips();
    setTrips(active);
    setLoading(false);
    // Auto-seleccionar si hay uno solo
    if (active.length === 1) {
      setSelectedTrip(active[0]);
      const cx = await getTripCrossings(active[0].id);
      setCrossings(cx);
    }
  }

  useEffect(() => {
    loadTrips();
    // Suscribirse a cambios en tiempo real
    const channel = subscribeLiveTrips(() => {
      loadTrips();
      if (selectedTrip) {
        getTripCrossings(selectedTrip.id).then(setCrossings);
      }
    });
    return () => { channel.unsubscribe(); };
  }, []);

  // Recargar crossings cuando cambia el trip seleccionado
  useEffect(() => {
    if (selectedTrip) {
      getTripCrossings(selectedTrip.id).then(setCrossings);
    }
  }, [selectedTrip?.id, selectedTrip?.toll_count]);

  // Auto-refresh cada 10s
  useEffect(() => {
    const interval = setInterval(() => {
      loadTrips();
      if (selectedTrip) {
        getTripCrossings(selectedTrip.id).then(setCrossings);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [selectedTrip?.id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <div className="w-10 h-10 border-4 border-cream-dark border-t-primary rounded-full animate-spin" />
        <p className="text-sm text-tierra mt-4">Cargando...</p>
      </div>
    );
  }

  if (trips.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <svg className="w-16 h-16 mb-3 text-tierra opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <p className="font-medium text-negro">Sin viajes activos</p>
        <p className="text-sm mt-1 text-tierra text-center">
          Cuando alguien inicie un viaje, aparecerá aquí en tiempo real
        </p>
        <button
          onClick={loadTrips}
          className="mt-4 px-4 py-2 rounded-xl text-sm text-primary bg-primary-light active:bg-primary/20"
        >
          Actualizar
        </button>
      </div>
    );
  }

  const t = selectedTrip || trips[0];
  const timeSinceUpdate = t ? Math.round((Date.now() - new Date(t.updated_at).getTime()) / 1000) : 0;

  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      <h1 className="text-lg font-bold text-negro">En vivo</h1>

      {/* Lista de viajes activos */}
      {trips.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {trips.map((tr) => (
            <button
              key={tr.id}
              onClick={() => setSelectedTrip(tr)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                t.id === tr.id ? 'bg-negro text-cream' : 'bg-cream-dark text-tierra'
              }`}
            >
              {tr.driver}
            </button>
          ))}
        </div>
      )}

      {/* Card principal */}
      <div className="bg-negro rounded-2xl p-6 text-cream">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-tierra">
            {t.driver}
            {t.is_active && <span className="text-cream/60"> &middot; en ruta</span>}
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-primary/30 text-primary-light">
            <span className={`w-2 h-2 rounded-full ${timeSinceUpdate < 30 ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'}`} />
            {timeSinceUpdate < 30 ? 'En vivo' : `Hace ${timeSinceUpdate}s`}
          </span>
        </div>
        <p className="text-5xl font-bold tracking-tight mt-2">{formatCLP(t.total_cost || 0)}</p>
        <p className="text-sm text-tierra mt-2">
          {t.toll_count === 0
            ? 'Sin peajes aún'
            : `${t.toll_count} peaje${t.toll_count > 1 ? 's' : ''} cruzado${t.toll_count > 1 ? 's' : ''}`}
        </p>
        {t.last_toll && (
          <p className="text-xs text-hongo mt-1">Último: {t.last_toll}</p>
        )}
      </div>

      {/* Ubicación */}
      {t.lat && t.lng && (
        <div className="bg-cream-dark rounded-xl p-3 text-xs text-tierra flex justify-between">
          <span>{t.lat.toFixed(4)}, {t.lng.toFixed(4)}</span>
          <span>{Math.round(t.speed || 0)} km/h</span>
        </div>
      )}

      {/* Peajes cruzados */}
      {crossings.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-negro px-1">Peajes detectados</h2>
          {[...crossings].reverse().map((c) => (
            <div key={c.id} className="flex items-center justify-between bg-cream-dark rounded-xl px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-light rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-negro text-sm">{c.toll_nombre}</p>
                  <p className="text-xs text-tierra">{c.toll_ruta} &middot; {formatTime(c.crossed_at)}</p>
                </div>
              </div>
              <span className="font-semibold text-primary">{formatCLP(c.tarifa)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
