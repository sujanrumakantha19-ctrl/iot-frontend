import { useState, useEffect, memo } from 'react'
import { getSession } from '../../services/auth'

function getGreeting(hour) {
  if (hour >= 5 && hour < 12) return { text: 'Good Morning', icon: '🌤️', gradient: 'from-amber-500 via-orange-400 to-yellow-500' }
  if (hour >= 12 && hour < 17) return { text: 'Good Afternoon', icon: '☀️', gradient: 'from-sky-600 via-blue-500 to-indigo-500' }
  if (hour >= 17 && hour < 21) return { text: 'Good Evening', icon: '🌇', gradient: 'from-rose-600 via-purple-600 to-indigo-700' }
  return { text: 'Good Night', icon: '🌙', gradient: 'from-slate-800 via-blue-900 to-indigo-950' }
}

// Isolated component — owns its own clock state so parent never re-renders on tick
const GreetingBanner = memo(function GreetingBanner() {
  const session = getSession()
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(tick)
  }, [])

  const { text: greetingText, icon: greetingIcon, gradient } = getGreeting(now.getHours())
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const dateStr = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <div className={`relative overflow-hidden rounded-xl bg-gradient-to-r ${gradient} p-5 flex items-center justify-between`}>
      {/* Decorative circles */}
      <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-white/10" />
      <div className="absolute -bottom-8 right-16 w-20 h-20 rounded-full bg-white/5" />

      <div className="relative z-10 flex items-center gap-4">
        <span className="text-4xl select-none">{greetingIcon}</span>
        <div>
          <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-0.5">
            {greetingText}
          </p>
          <h2 className="text-white text-xl font-extrabold tracking-tight leading-tight">
            {session?.name || 'Administrator'}
          </h2>
          <p className="text-white/60 text-[11px] mt-1 font-medium">
            Here's your operational overview for today
          </p>
        </div>
      </div>

      <div className="relative z-10 text-right hidden sm:block">
        <p className="text-white text-2xl font-extrabold tabular-nums tracking-tight">{timeStr}</p>
        <p className="text-white/60 text-[11px] font-medium mt-0.5">{dateStr}</p>
      </div>
    </div>
  )
})

export default GreetingBanner
