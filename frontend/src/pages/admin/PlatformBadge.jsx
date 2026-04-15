export default function PlatformBadge({ platform }) {
  const cls = platform === 'ios' ? 'bg-blue-500/30 text-blue-300'
    : platform === 'android' ? 'bg-green-500/30 text-green-300'
    : 'bg-gray-500/30 text-gray-300';
  const label = platform === 'ios' ? 'iOS' : platform === 'android' ? 'Android' : 'Web';
  return <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${cls}`}>{label}</span>;
}
