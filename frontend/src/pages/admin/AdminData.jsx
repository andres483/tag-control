import { formatCLP, formatTime } from '../../lib/format';

export default function AdminData({ stats, allCrossings, allTrips }) {
  return (
    <div className="flex flex-col gap-4">
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
