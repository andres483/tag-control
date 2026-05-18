export default function PlatformBadge({ platform }) {
  if (platform !== 'ios' && platform !== 'android') return null;
  const cls = platform === 'ios' ? 'bg-blue-500/30 text-blue-300' : 'bg-green-500/30 text-green-300';
  const label = platform === 'ios' ? 'iOS' : 'Android';
  return <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${cls}`}>{label}</span>;
}
