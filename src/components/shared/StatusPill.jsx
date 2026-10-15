export default function StatusPill({ status, onlineText = 'Online', offlineText = 'Offline' }) {
  const isOnline = status === 'online'
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
      isOnline ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
      {isOnline ? onlineText : offlineText}
    </span>
  )
}
