export default function LoadingSpinner({ text = 'Loading Telemetry...' }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-[var(--text-secondary)]">
      <div className="w-8 h-8 rounded-full border-2 border-[var(--border-light)] border-t-[var(--accent-primary)] animate-spin mb-3.5" />
      <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] font-mono">{text}</span>
    </div>
  )
}
