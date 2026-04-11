import { getTarifa } from '../lib/pricing';
import { formatCLP, formatTime } from '../lib/format';

export default function TollChip({ crossing }) {
  const { toll, timestamp, inferred } = crossing;

  return (
    <div className="flex items-center justify-between bg-surface-secondary rounded-2xl px-4 py-3.5">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${inferred ? 'bg-text-tertiary/20' : 'bg-primary/10'}`}>
          <svg className={`w-5 h-5 ${inferred ? 'text-text-tertiary' : 'text-primary'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
          </svg>
        </div>
        <div>
          <p className="text-[14px] font-medium text-text">{toll.nombre}</p>
          <p className="text-[12px] text-text-tertiary">
            {toll.ruta} &middot; {formatTime(timestamp)}
            {inferred && ' (estimado)'}
          </p>
        </div>
      </div>
      <span className="text-[15px] font-semibold text-primary">{formatCLP(getTarifa(toll, new Date(timestamp)))}</span>
    </div>
  );
}
