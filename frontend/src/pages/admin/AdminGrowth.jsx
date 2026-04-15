import { formatCLP } from '../../lib/format';

const PLATS = [
  { k: 'ios', label: 'iOS', color: '#3b82f6' },
  { k: 'android', label: 'Android', color: '#22c55e' },
  { k: 'web', label: 'Web', color: '#a855f7' },
  { k: 'unknown', label: '?', color: '#6b7280' },
];

function pct(curr, prev) {
  if (!prev || prev === 0) return null;
  return Math.round(((curr - prev) / prev) * 100);
}

function PctBadge({ rate }) {
  if (rate === null) return null;
  const color = rate > 0 ? 'text-green-400' : rate < 0 ? 'text-red-400' : 'text-gray-400';
  return <span className={`${color} text-[10px] ml-0.5`}>{rate > 0 ? '+' : ''}{rate}%</span>;
}

export default function AdminGrowth({ stats, users, growthData, cumulativeData, growthView, setGrowthView }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex bg-white/5 rounded-lg p-0.5">
        {['dia', 'acumulado'].map(v => (
          <button
            key={v}
            onClick={() => setGrowthView(v)}
            className={`flex-1 py-1.5 rounded-md text-[11px] font-medium transition-colors ${growthView === v ? 'bg-primary text-white' : 'text-gray-400'}`}
          >
            {v === 'dia' ? 'Por día' : 'Acumulado'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-2">
        {[
          { v: stats?.registeredUsers || 0, l: 'Usuarios' },
          { v: stats?.totalTrips || 0, l: 'Viajes' },
          { v: stats?.totalTolls || 0, l: 'Peajes' },
          { v: stats?.activeTrips || 0, l: 'Activos', green: true },
        ].map(k => (
          <div key={k.l} className="bg-white/5 rounded-lg p-2 text-center">
            <p className={`text-xl font-bold ${k.green ? 'text-green-400' : ''}`}>{k.v}</p>
            <p className="text-[10px] text-gray-400">{k.l}</p>
          </div>
        ))}
      </div>

      <div className="bg-white/5 rounded-lg p-3 flex justify-between items-center">
        <div>
          <p className="text-[10px] text-gray-400">Gasto total</p>
          <p className="text-2xl font-bold text-primary">{formatCLP(stats?.totalCost || 0)}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-gray-400">Prom/viaje</p>
          <p className="text-lg font-bold">{formatCLP(stats?.avgCostPerTrip || 0)}</p>
        </div>
      </div>

      {stats && (() => {
        const tp = stats.tripsByPlatform || { ios: 0, android: 0, web: 0, unknown: 0 };
        const up = stats.usersByPlatform || { ios: 0, android: 0, web: 0, unknown: 0 };
        const tripTotal = Object.values(tp).reduce((a, b) => a + b, 0) || 1;
        const userTotal = Object.values(up).reduce((a, b) => a + b, 0) || 1;
        return (
          <div className="bg-white/5 rounded-lg p-3 space-y-3">
            <p className="text-[10px] text-gray-400">Plataformas</p>
            {[{ label: 'Viajes', data: tp, total: tripTotal }, { label: 'Usuarios', data: up, total: userTotal }].map(row => (
              <div key={row.label}>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-gray-300">{row.label}</span>
                  <span className="text-gray-500">{row.total}</span>
                </div>
                <div className="flex h-3 rounded overflow-hidden bg-white/5">
                  {PLATS.map(p => {
                    const val = row.data[p.k] || 0;
                    if (!val) return null;
                    const pctW = (val / row.total) * 100;
                    return <div key={p.k} style={{ width: `${pctW}%`, background: p.color }} title={`${p.label}: ${val}`} />;
                  })}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
                  {PLATS.map(p => {
                    const val = row.data[p.k] || 0;
                    if (!val) return null;
                    return (
                      <div key={p.k} className="flex items-center gap-1 text-[10px]">
                        <span style={{ width: 8, height: 8, background: p.color, borderRadius: 2, display: 'inline-block' }} />
                        <span className="text-gray-300">{p.label}</span>
                        <span className="text-gray-500">{val}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {growthData.length > 0 && (() => {
        const isCum = growthView === 'acumulado';
        const src = isCum ? cumulativeData : growthData;
        const charts = isCum
          ? [{ key: 'cumUsers', label: 'Usuarios', color: '#22c55e' }, { key: 'cumTrips', label: 'Viajes', color: '#3b82f6' }, { key: 'cumGasto', label: 'Gasto', color: '#2D6A4F' }]
          : [{ key: 'newUsers', label: '+Usuarios', color: '#22c55e' }, { key: 'trips', label: 'Viajes', color: '#3b82f6' }, { key: 'gasto', label: 'Gasto', color: '#2D6A4F' }];
        const sliced = src.slice(-7);
        return (
          <div className="grid grid-cols-3 gap-2">
            {charts.map(chart => {
              const max = Math.max(...sliced.map(d => d[chart.key] || 0), 1);
              const latest = sliced[sliced.length - 1]?.[chart.key] || 0;
              return (
                <div key={chart.key} className="bg-white/5 rounded-lg p-2">
                  <p className="text-[11px] text-gray-400">{chart.label}</p>
                  <p className="text-[13px] font-bold" style={{ color: chart.color }}>
                    {chart.key.includes('asto') ? formatCLP(latest) : latest}
                  </p>
                  <div style={{ position: 'relative', height: 60, marginTop: 4 }}>
                    {sliced.map((day, idx) => {
                      const val = day[chart.key] || 0;
                      const hPx = Math.max(Math.round((val / max) * 46), 2);
                      const barWidth = 100 / sliced.length;
                      return (
                        <div key={day.date} style={{
                          position: 'absolute', bottom: 0,
                          left: `${idx * barWidth}%`,
                          width: `${barWidth - 1}%`,
                          display: 'flex', flexDirection: 'column', alignItems: 'center',
                        }}>
                          {val > 0 && (
                            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', marginBottom: 2 }}>
                              {chart.key.includes('asto') ? `${Math.round(val/1000)}k` : val}
                            </span>
                          )}
                          <div style={{ width: '100%', height: hPx, background: chart.color, borderRadius: 2 }} />
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between mt-0.5">
                    <span className="text-[10px] text-gray-400">{sliced[0]?.date?.split('/').slice(0,2).join('/')}</span>
                    <span className="text-[10px] text-gray-400">hoy</span>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      <div className="bg-white/5 rounded-lg p-3">
        <p className="text-[10px] text-gray-400 mb-2">{growthView === 'acumulado' ? 'Acumulado' : 'Por día'}</p>
        <div className="grid grid-cols-5 gap-0 text-[11px] text-gray-400 border-b border-white/10 pb-1 mb-1 font-medium">
          <span>Día</span><span className="text-center">Users</span><span className="text-center">Viajes</span><span className="text-center">Peajes</span><span className="text-right">Gasto</span>
        </div>
        {(() => {
          const src = growthView === 'acumulado' ? cumulativeData : growthData;
          if (src.length === 0) return <p className="text-gray-400 text-xs text-center py-2">Sin datos</p>;
          return src.map((day, i) => {
            const isCum = growthView === 'acumulado';
            const u = isCum ? day.cumUsers : day.newUsers;
            const t = isCum ? day.cumTrips : day.trips;
            const tl = isCum ? day.cumTolls : day.tolls;
            const g = isCum ? day.cumGasto : day.gasto;
            const prev = i > 0 ? src[i-1] : null;
            const pu = prev ? (isCum ? prev.cumUsers : prev.newUsers) : 0;
            const pt = prev ? (isCum ? prev.cumTrips : prev.trips) : 0;
            const ptl = prev ? (isCum ? prev.cumTolls : prev.tolls) : 0;
            const pg = prev ? (isCum ? prev.cumGasto : prev.gasto) : 0;
            return (
              <div key={day.date} className="grid grid-cols-5 gap-0 text-[11px] py-1.5 border-b border-white/10">
                <span className="text-gray-400">{day.date}</span>
                <span className="text-center">
                  {u > 0 ? (isCum ? u : <span className="text-green-400">+{u}</span>) : '—'}
                  <PctBadge rate={pct(u, pu)} />
                </span>
                <span className="text-center">
                  {t || '—'}
                  <PctBadge rate={pct(t, pt)} />
                </span>
                <span className="text-center">
                  {tl || '—'}
                  <PctBadge rate={pct(tl, ptl)} />
                </span>
                <span className="text-right text-primary font-medium">
                  {g > 0 ? formatCLP(g) : '—'}
                  <PctBadge rate={pct(g, pg)} />
                </span>
              </div>
            );
          });
        })()}
      </div>

      {users.length > 0 && (
        <div className="bg-white/5 rounded-lg p-3">
          <div className="flex justify-between items-center mb-2">
            <p className="text-[10px] text-gray-400">Usuarios ({users.length})</p>
            {users.length >= 10 && <span className="text-[11px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded-full">Waitlist</span>}
          </div>
          {users.map(u => {
            const cost = stats?.costByDriver?.[u.name] || 0;
            const trips = stats?.tripsByDriver?.[u.name] || 0;
            const max = Math.max(...(stats?.driverList || []).map(x => stats?.costByDriver?.[x] || 0), 1);
            const w = Math.max((cost / max) * 100, 4);
            return (
              <div key={u.name} className="flex items-center gap-2 mb-1.5">
                <span className="text-[11px] w-20 shrink-0 truncate">{u.name}</span>
                <div className="flex-1 bg-white/5 rounded-full h-5">
                  <div className="bg-primary h-5 rounded-full flex items-center px-1.5" style={{ width: `${w}%`, minWidth: 36 }}>
                    <span className="text-[10px] text-white whitespace-nowrap">{formatCLP(cost)}</span>
                  </div>
                </div>
                <span className="text-[11px] text-gray-400 w-6 text-right">{trips}v</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
