import { formatCLP, formatDate, formatTime } from '../../lib/format';
import PlatformBadge from './PlatformBadge';

export default function AdminTrips({
  completedTrips,
  selectedTripId,
  setSelectedTripId,
  reconstructing,
  reconstructResults,
  onReconstructAll,
  onReconstructTrip,
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="bg-white/5 rounded-xl p-4 mb-2">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm font-medium">Reconstruir peajes</p>
            <p className="text-[11px] text-gray-400">Analiza posiciones GPS para encontrar peajes perdidos</p>
          </div>
          <button
            onClick={onReconstructAll}
            disabled={reconstructing}
            className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold disabled:opacity-50"
          >
            {reconstructing ? 'Analizando...' : 'Reconstruir todos'}
          </button>
        </div>
        {reconstructResults && (
          <div className="mt-3 pt-3 border-t border-white/10">
            {reconstructResults[0]?.error ? (
              <p className="text-xs text-red-400">Error: {reconstructResults[0].error}</p>
            ) : reconstructResults.length === 0 ? (
              <p className="text-xs text-gray-400">Sin posiciones GPS disponibles (expiran en 24 h)</p>
            ) : (
              <>
                <p className="text-xs text-green-400 font-medium mb-1.5">
                  {reconstructResults.length} {reconstructResults.length === 1 ? 'viaje actualizado' : 'viajes actualizados'} —{' '}
                  +{reconstructResults.reduce((s, r) => s + r.newTolls, 0)} peajes recuperados
                </p>
                {reconstructResults.map((r, i) => (
                  <div key={i} className="flex justify-between text-xs py-0.5 text-gray-400">
                    <span className="truncate max-w-[180px]">{r.tripId?.replace(/^trip-/, '')}</span>
                    <span className="text-green-400 shrink-0 ml-2">+{r.newTolls}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {completedTrips.length === 0 && (
        <p className="text-center text-gray-400 text-sm py-4">
          Los viajes aparecerán aquí cuando alguien presione "Detener viaje" (versión nueva)
        </p>
      )}
      {completedTrips.map(t => {
        const cx = t.crossings || [];
        const isOpen = selectedTripId === t.id;
        return (
          <button
            key={t.id}
            onClick={() => setSelectedTripId(isOpen ? null : t.id)}
            className={`text-left rounded-xl p-4 transition-colors ${isOpen ? 'bg-primary/20' : 'bg-white/5'}`}
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="font-medium text-sm flex items-center gap-1.5">
                  {t.driver}
                  <PlatformBadge platform={t.platform} />
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {formatDate(t.start_time)} &middot; {formatTime(t.start_time)} – {formatTime(t.end_time)}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {(t.routes || []).join(' → ')}
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold text-primary text-sm">{formatCLP(t.total_cost || 0)}</p>
                <p className="text-xs text-gray-400">{t.toll_count || 0} peajes</p>
              </div>
            </div>
            {isOpen && (
              <div className="mt-3 flex flex-col gap-1.5">
                {cx.map((c, i) => (
                  <div key={i} className="flex justify-between text-xs bg-white/5 rounded-lg px-3 py-2">
                    <span>
                      {c.tollNombre} <span className="text-gray-400">({c.tollRuta})</span>
                      {c.inferred && <span className="text-yellow-400 ml-1">(GPS)</span>}
                      <span className="text-gray-400 ml-1">{formatTime(c.timestamp)}</span>
                    </span>
                    <span className="text-primary font-medium">{formatCLP(c.tarifa)}</span>
                  </div>
                ))}
                <button
                  onClick={(e) => { e.stopPropagation(); onReconstructTrip(t.id); }}
                  disabled={reconstructing}
                  className="mt-1 text-[11px] text-primary font-medium py-1.5 bg-primary/10 rounded-lg disabled:opacity-50"
                >
                  {reconstructing ? 'Reconstruyendo...' : 'Reconstruir desde GPS'}
                </button>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
