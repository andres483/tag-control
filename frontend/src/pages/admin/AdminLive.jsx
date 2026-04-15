import { formatCLP, formatTime } from '../../lib/format';
import PlatformBadge from './PlatformBadge';

export default function AdminLive({
  mapRef,
  mapsReady,
  liveTrips,
  liveCrossingsByTrip,
  expandedLiveTrip,
  setExpandedLiveTrip,
  locations,
}) {
  return (
    <div className="flex flex-col gap-0 -mx-4 -mt-4">
      <div className="relative">
        <div ref={mapRef} className="w-full h-[50vh] bg-white/5" />
        {!mapsReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-text/50">
            <div className="w-8 h-8 border-4 border-cream/20 border-t-primary rounded-full animate-spin" />
          </div>
        )}
        {liveTrips.length === 0 && mapsReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-text/60">
            <div className="text-center">
              <p className="text-white font-medium">Sin viajes activos</p>
              <p className="text-gray-400 text-xs mt-1">Los viajes aparecerán aquí en tiempo real</p>
            </div>
          </div>
        )}
        {liveTrips.length > 0 && (
          <div className="absolute top-3 left-3 bg-text/80 backdrop-blur-sm px-3 py-1.5 rounded-full">
            <span className="text-xs text-white font-medium">
              <span className="inline-block w-2 h-2 bg-green-400 rounded-full animate-pulse mr-1.5" />
              {liveTrips.length} en ruta
            </span>
          </div>
        )}
      </div>

      <div className="px-4 -mt-6 relative z-10 flex flex-col gap-3">
        {liveTrips.map(t => {
          const ago = Math.round((Date.now() - new Date(t.updated_at).getTime()) / 1000);
          const isRecent = ago < 30;
          const isExpanded = expandedLiveTrip === t.id;
          const tripCx = liveCrossingsByTrip[t.id] || [];
          return (
            <div key={t.id} className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 overflow-hidden">
              <button
                onClick={() => setExpandedLiveTrip(isExpanded ? null : t.id)}
                className="w-full p-4 text-left"
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                      <span className="text-white font-bold">{t.driver?.charAt(0)?.toUpperCase()}</span>
                    </div>
                    <div>
                      <p className="font-bold text-white flex items-center gap-1.5">
                        {t.driver}
                        <PlatformBadge platform={t.platform} />
                      </p>
                      <p className="text-xs text-gray-400 flex items-center gap-1">
                        <span className={`inline-block w-1.5 h-1.5 rounded-full ${isRecent ? 'bg-green-400' : 'bg-yellow-400'}`} />
                        {isRecent ? 'En vivo' : `Hace ${ago}s`}
                        &middot; {Math.round(t.speed || 0)} km/h
                        {locations[t.id] && <> &middot; {locations[t.id]}</>}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary">{formatCLP(t.total_cost || 0)}</p>
                    <p className="text-xs text-gray-400">{t.toll_count || 0} peajes ▾</p>
                  </div>
                </div>
              </button>

              {isExpanded && (
                <div className="px-4 pb-4">
                  <div className="border-t border-white/10 pt-3 flex flex-col gap-2">
                    {tripCx.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center">Sin peajes aún</p>
                    ) : (
                      tripCx.map((c, i) => (
                        <div key={c.id} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 bg-primary/20 rounded-full flex items-center justify-center text-[10px] text-primary font-bold">{i + 1}</span>
                            <div>
                              <span className="text-white">{c.toll_nombre}</span>
                              <span className="text-gray-400 ml-1">{formatTime(c.crossed_at)}</span>
                            </div>
                          </div>
                          <span className="text-primary font-medium">{formatCLP(c.tarifa)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
