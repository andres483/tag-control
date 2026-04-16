import { formatCLP, formatDate, formatTime } from '../../lib/format';

const SEVERITY = {
  error:   { bg: 'bg-red-500/10',    border: 'border-red-500/30',    text: 'text-red-400',    dot: 'bg-red-500' },
  warning: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400', dot: 'bg-yellow-400' },
  info:    { bg: 'bg-blue-500/10',   border: 'border-blue-500/30',   text: 'text-blue-400',   dot: 'bg-blue-400' },
};

const POSITIONS_TTL_MS = 24 * 60 * 60 * 1000;

export default function AdminData({ stats, allCrossings, allTrips, completedTrips = [], onReconstructTrip, reconstructing, reconstructResults, qaResult, feedbackItems = [] }) {
  const now = Date.now();
  const atRisk = completedTrips.filter(t => (t.toll_count || 0) === 0);

  const resultByTrip = {};
  if (reconstructResults) {
    for (const r of reconstructResults) {
      if (r.tripId) resultByTrip[r.tripId] = r;
    }
  }

  return (
    <div className="flex flex-col gap-4">

      {/* QA Agent findings */}
      {qaResult && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">QA Agent</p>
            <span className="text-[9px] text-gray-600">
              {qaResult.healthy ? '✓ Todo ok' : `${qaResult.findings.length} issue${qaResult.findings.length > 1 ? 's' : ''}`}
              {' · '}{new Date(qaResult.runAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          {qaResult.healthy ? (
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-3 py-2.5">
              <p className="text-[11px] text-green-400 font-medium">Sistema saludable — sin anomalías detectadas</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {qaResult.findings.map((f, i) => {
                const s = SEVERITY[f.severity] || SEVERITY.warning;
                return (
                  <div key={i} className={`${s.bg} border ${s.border} rounded-xl px-3 py-2.5`}>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />
                      <p className={`text-[11px] font-semibold ${s.text}`}>{f.message}</p>
                    </div>
                    <p className="text-[10px] text-gray-500 ml-3.5">{f.detail}</p>
                    {f.action && <p className={`text-[10px] ml-3.5 mt-0.5 font-medium ${s.text} opacity-70`}>→ {f.action}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {atRisk.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3">
          <div className="flex justify-between items-center mb-2">
            <p className="text-xs font-semibold text-yellow-300">⚠ Viajes en riesgo ({atRisk.length})</p>
            <span className="text-[10px] text-yellow-400/70">0 peajes detectados — posible falla</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {atRisk.slice(0, 10).map(t => (
              <div key={t.id} className="flex items-center justify-between text-xs bg-white/5 rounded-lg px-3 py-2">
                <div>
                  <span className="font-medium">{t.driver}</span>
                  <span className="text-gray-400 ml-2">{formatDate(t.start_time)} {formatTime(t.start_time)}</span>
                </div>
                {onReconstructTrip && (() => {
                  const res = resultByTrip[t.id];
                  if (res?.error) return (
                    <span className="text-[10px] text-red-400 px-2">Error</span>
                  );
                  if (res) return (
                    <span className="text-[10px] text-green-400 px-2">
                      {res.newTolls > 0 ? `+${res.newTolls} peajes` : 'Sin datos GPS'}
                    </span>
                  );
                  const canReconstruct = now - new Date(t.start_time).getTime() < POSITIONS_TTL_MS;
                  if (!canReconstruct) return (
                    <span className="text-[10px] text-gray-600 px-2">Posiciones expiradas</span>
                  );
                  return (
                    <button
                      onClick={() => onReconstructTrip(t.id)}
                      disabled={reconstructing}
                      className="text-[10px] text-yellow-300 font-medium px-2 py-1 bg-yellow-500/20 rounded disabled:opacity-50"
                    >
                      {reconstructing ? '...' : 'Reconstruir'}
                    </button>
                  );
                })()}
              </div>
            ))}
          </div>
        </div>
      )}

      {feedbackItems.length > 0 && (
        <div>
          <p className="text-xs text-gray-400 mb-2 font-medium">Diagnósticos recibidos ({feedbackItems.length})</p>
          <div className="flex flex-col gap-1.5">
            {feedbackItems.map(f => (
              <div key={f.id} className="bg-white/5 rounded-xl px-3 py-2.5 text-xs">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-medium">{f.driver}</span>
                  <span className="text-gray-500">{f.platform} · {new Date(f.created_at).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <p className="text-gray-400">{f.error_message}</p>
                {f.notes && <p className="text-gray-300 mt-0.5 italic">"{f.notes}"</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-xs text-gray-400 mb-2 font-medium">Usuarios registrados</p>
        <div className="flex flex-wrap gap-2">
          {stats?.driverList.map(d => (
            <span key={d} className="bg-white/5 px-3 py-1 rounded-full text-xs">{d}</span>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs text-gray-400 mb-2 font-medium">Últimos 20 cruces de peajes</p>
        <div className="bg-white/5 rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/10 text-gray-400">
                <th className="px-3 py-2 text-left">Peaje</th>
                <th className="px-3 py-2 text-left">Ruta</th>
                <th className="px-3 py-2 text-right">Tarifa</th>
                <th className="px-3 py-2 text-right">Hora</th>
              </tr>
            </thead>
            <tbody>
              {allCrossings.slice(0, 20).map(c => (
                <tr key={c.id} className="border-b border-white/10">
                  <td className="px-3 py-2">{c.toll_nombre}</td>
                  <td className="px-3 py-2 text-gray-400">{c.toll_ruta}</td>
                  <td className="px-3 py-2 text-right text-primary">{formatCLP(c.tarifa)}</td>
                  <td className="px-3 py-2 text-right text-gray-400">{formatTime(c.crossed_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <p className="text-xs text-gray-400 mb-2 font-medium">Base de datos</p>
        <div className="bg-white/5 rounded-xl p-3 text-xs text-gray-400">
          <p>live_trips: {allTrips.length} registros</p>
          <p>live_crossings: {allCrossings.length} registros</p>
          <p>Supabase: nttnryildsxllxqfkkvz</p>
        </div>
      </div>
    </div>
  );
}
